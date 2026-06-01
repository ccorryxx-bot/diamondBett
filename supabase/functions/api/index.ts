// HUIDU Gaming API — Game Launch + Balance Callback Edge Function (Production)
// AES-256-ECB + PKCS7  (key = raw UTF-8 string, 32 bytes)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

// ── Production credentials (V3-DiamodBETT-260601) ──────────────────────────
const AGENCY_UID    = '31ce96cb1fbe80b35b4917ba95627d64'
const AES_KEY_STR   = '526bedff1dc3050b0513ff20f0b775e5'  // 32 chars = AES-256
const PLAYER_PREFIX = 'hdf801'
// Calls route through static-IP VM proxy → whitelisted by HUIDU
const SERVER_URL    = 'http://216.146.26.239:3000'
const PROXY_SECRET  = 'dbet_proxy_k9x2mw7q'
const HOME_URL      = 'https://diamond-bett.vercel.app'
// HUIDU will POST balance updates here after each game session
const CALLBACK_URL  = 'https://xjqrwcsxiaybpztzestb.supabase.co/functions/v1/api/games/callback'

// ─── AES-256-ECB + PKCS7 ─────────────────────────────────────────────────────
async function aes256EcbEncryptBase64(plaintext: string, keyStr: string): Promise<string> {
  const enc       = new TextEncoder()
  const keyBytes  = enc.encode(keyStr)
  const dataBytes = enc.encode(plaintext)

  const BLOCK  = 16
  const padLen = BLOCK - (dataBytes.length % BLOCK)
  const padded = new Uint8Array(dataBytes.length + padLen)
  padded.set(dataBytes)
  padded.fill(padLen, dataBytes.length)

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'AES-CBC' }, false, ['encrypt']
  )

  const numBlocks = padded.length / BLOCK
  const result    = new Uint8Array(padded.length)
  const zeroIV    = new Uint8Array(BLOCK)

  for (let i = 0; i < numBlocks; i++) {
    const block = padded.slice(i * BLOCK, (i + 1) * BLOCK)
    const enc32 = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: zeroIV }, cryptoKey, block)
    result.set(new Uint8Array(enc32).slice(0, BLOCK), i * BLOCK)
  }

  return btoa(String.fromCharCode(...result))
}

async function aes256EcbDecryptBase64(base64: string, keyStr: string): Promise<string> {
  const enc      = new TextEncoder()
  const keyBytes = enc.encode(keyStr)
  const cipher   = Uint8Array.from(atob(base64), c => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'AES-CBC' }, false, ['decrypt']
  )

  const BLOCK    = 16
  const numBlocks = cipher.length / BLOCK
  const result   = new Uint8Array(cipher.length)
  const zeroIV   = new Uint8Array(BLOCK)

  for (let i = 0; i < numBlocks; i++) {
    const block = cipher.slice(i * BLOCK, (i + 1) * BLOCK)
    // Pad to 2 blocks for AES-CBC (needs at least 2 blocks: IV + data)
    const buf = new Uint8Array(BLOCK * 2)
    buf.set(block, BLOCK)
    const dec = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: zeroIV }, cryptoKey, buf)
    result.set(new Uint8Array(dec).slice(0, BLOCK), i * BLOCK)
  }

  // Remove PKCS7 padding
  const padLen = result[result.length - 1]
  return new TextDecoder().decode(result.slice(0, result.length - padLen))
}

// ─── CORS ─────────────────────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
}

function json200(body: object) {
  return Response.json(body, { status: 200, headers: corsHeaders })
}

function makeSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )
}

// ─── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: corsHeaders })

  const url = new URL(req.url)

  // ── Route 1: Game Launch ─────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname.endsWith('/games/launch')) {
    try {
      const body = await req.json()
      const { user_id, game_uid, platform = 2 } = body

      if (!user_id || !game_uid)
        return json200({ code: 1, msg: 'Missing user_id or game_uid' })

      const supabase = makeSupabase()

      const { data: user, error: userErr } = await supabase
        .from('users')
        .select('balance, phone')
        .eq('id', user_id)
        .single()

      if (userErr || !user)
        return json200({ code: 1, msg: 'User not found' })

      const memberAcct   = `${PLAYER_PREFIX}_${user_id.replace(/-/g, '').slice(0, 10)}`
      const creditAmount = Math.max(parseFloat(String(user.balance ?? '0')) || 0, 0)
      const timestamp    = Math.floor(Date.now() / 1000)

      const innerPayload = {
        timestamp,
        agency_uid    : AGENCY_UID,
        member_account: memberAcct,
        game_uid,
        credit_amount : creditAmount,
        currency_code : 'MMK',
        language      : 'zh',
        home_url      : HOME_URL,
        callback_url  : CALLBACK_URL,
        platform,
      }

      const encryptedPayload = await aes256EcbEncryptBase64(
        JSON.stringify(innerPayload),
        AES_KEY_STR
      )

      // Call through VM proxy (static IP 216.146.26.239 — whitelisted by HUIDU)
      const huiduResp = await fetch(`${SERVER_URL}/game/v1`, {
        method : 'POST',
        headers: {
          'Content-Type'  : 'application/json',
          'x-proxy-secret': PROXY_SECRET,
        },
        body: JSON.stringify({ agency_uid: AGENCY_UID, timestamp, payload: encryptedPayload }),
      })

      const huiduData = await huiduResp.json() as {
        code    : number
        msg?    : string
        message?: string
        payload?: { game_launch_url?: string; url?: string; game_url?: string }
        game_url?       : string
        url?            : string
        game_launch_url?: string
      }

      if (huiduData.code !== 0)
        return json200({ code: huiduData.code ?? 1, msg: huiduData.msg || huiduData.message || 'Game API error' })

      const gameUrl = (
        huiduData.payload?.game_launch_url
        ?? huiduData.payload?.url
        ?? huiduData.payload?.game_url
        ?? huiduData.game_url
        ?? huiduData.url
        ?? huiduData.game_launch_url
      )

      if (!gameUrl)
        return json200({ code: 1, msg: 'No game URL in response' })

      return json200({ code: 0, game_url: gameUrl })

    } catch (err) {
      return json200({ code: 1, msg: `Server error: ${String(err)}` })
    }
  }

  // ── Route 2: HUIDU Balance Callback ──────────────────────────────────────
  // HUIDU POSTs here after each game session with updated player balance.
  if (req.method === 'POST' && url.pathname.endsWith('/games/callback')) {
    try {
      const body = await req.json() as {
        agency_uid?: string
        timestamp? : number
        payload?   : string
        // Some HUIDU versions send fields directly (unencrypted)
        member_account?: string
        balance?       : number
        currency_code? : string
      }

      let memberAcct: string | undefined
      let newBalance: number | undefined

      // Try decrypting payload first
      if (body.payload) {
        try {
          const decrypted = await aes256EcbDecryptBase64(body.payload, AES_KEY_STR)
          const parsed    = JSON.parse(decrypted) as {
            member_account?: string
            balance?       : number
            after_balance? : number
            credit_amount? : number
          }
          memberAcct = parsed.member_account
          newBalance = parsed.balance ?? parsed.after_balance ?? parsed.credit_amount
        } catch {
          // Fall through to unencrypted fields
        }
      }

      // Fallback: unencrypted fields
      if (!memberAcct) memberAcct = body.member_account
      if (newBalance === undefined) newBalance = body.balance

      if (!memberAcct || newBalance === undefined)
        return json200({ code: 1, msg: 'Missing member_account or balance' })

      // member_account format: "hdf801_<user_id_first10>"
      const suffix = memberAcct.replace(`${PLAYER_PREFIX}_`, '')

      const supabase = makeSupabase()

      // Find user whose UUID (no dashes) starts with suffix
      const { data: users, error: findErr } = await supabase
        .from('users')
        .select('id, balance')

      if (findErr || !users?.length)
        return json200({ code: 1, msg: 'User lookup failed' })

      const matched = users.find(u =>
        u.id.replace(/-/g, '').slice(0, 10) === suffix
      )

      if (!matched)
        return json200({ code: 1, msg: 'User not found for member_account: ' + memberAcct })

      const { error: updateErr } = await supabase
        .from('users')
        .update({ balance: newBalance })
        .eq('id', matched.id)

      if (updateErr)
        return json200({ code: 1, msg: 'Balance update failed: ' + updateErr.message })

      return json200({ code: 0, msg: 'success' })

    } catch (err) {
      return json200({ code: 1, msg: `Callback error: ${String(err)}` })
    }
  }

  return json200({ code: 1, msg: 'Not found' })
})
