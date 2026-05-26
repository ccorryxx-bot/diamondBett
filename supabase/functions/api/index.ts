// HUIDU Gaming API — Game Launch Edge Function
// AES-256-ECB + PKCS7  (key = raw UTF-8 string, 32 bytes)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const AGENCY_UID    = '2c38947f4e36d6c7685583fa20e3acbf'
const AES_KEY_STR   = '479060999a47a3a311ba5ad48032a5e0'   // 32 ASCII chars = 32 bytes = AES-256
const PLAYER_PREFIX = 'he0cd4'
const SERVER_URL    = 'https://jsgame.live'
const HOME_URL      = 'https://diamond-bett.vercel.app'

// ─── AES-256-ECB + PKCS7 ─────────────────────────────────────────────────────
// Web Crypto has no native ECB.
// Simulate: AES-CBC with all-zero IV per block → each block = AES(block XOR 0) = AES-ECB block
async function aes256EcbEncryptBase64(plaintext: string, keyStr: string): Promise<string> {
  const enc       = new TextEncoder()
  const keyBytes  = enc.encode(keyStr)     // raw UTF-8 → 32 bytes → AES-256 key
  const dataBytes = enc.encode(plaintext)

  const BLOCK  = 16
  const padLen = BLOCK - (dataBytes.length % BLOCK)
  const padded = new Uint8Array(dataBytes.length + padLen)
  padded.set(dataBytes)
  padded.fill(padLen, dataBytes.length)    // PKCS7

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'AES-CBC' }, false, ['encrypt']
  )

  const numBlocks = padded.length / BLOCK
  const result    = new Uint8Array(padded.length)
  const zeroIV    = new Uint8Array(BLOCK)

  for (let i = 0; i < numBlocks; i++) {
    const block = padded.slice(i * BLOCK, (i + 1) * BLOCK)
    // AES-CBC(block, iv=0) first 16 bytes = AES(block XOR 0) = AES(block) = ECB ✓
    const enc32 = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: zeroIV }, cryptoKey, block)
    result.set(new Uint8Array(enc32).slice(0, BLOCK), i * BLOCK)
  }

  return btoa(String.fromCharCode(...result))
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

// ─── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: corsHeaders })

  const url = new URL(req.url)

  if (req.method === 'POST' && url.pathname.endsWith('/games/launch')) {
    try {
      const body = await req.json()
      const { user_id, game_uid, platform = 2 } = body

      if (!user_id || !game_uid)
        return json200({ code: 1, msg: 'Missing user_id or game_uid' })

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        { auth: { persistSession: false } }
      )

      const { data: user, error: userErr } = await supabase
        .from('users')
        .select('balance, phone')
        .eq('id', user_id)
        .single()

      if (userErr || !user)
        return json200({ code: 1, msg: 'User not found' })

      const memberAcct   = `${PLAYER_PREFIX}_${user_id.replace(/-/g, '').slice(0, 10)}`
      const creditAmount = Math.max(parseFloat(String(user.balance ?? '0')) || 0, 0)
      const timestamp    = Math.floor(Date.now() / 1000)   // UNIX seconds

      // NOTE: Change currency_code to 'MMK' once HUIDU enables it on your account.
      // Current value 'USD' is used because MMK is disabled on the test account.
      const currency_code = body.currency || 'USD'

      const innerPayload = {
        timestamp,
        agency_uid    : AGENCY_UID,
        member_account: memberAcct,
        game_uid,
        credit_amount : creditAmount,
        currency_code,
        language      : 'zh',
        home_url      : HOME_URL,
        platform,
      }

      const encryptedPayload = await aes256EcbEncryptBase64(
        JSON.stringify(innerPayload),
        AES_KEY_STR
      )

      const huiduResp = await fetch(`${SERVER_URL}/game/v1`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ agency_uid: AGENCY_UID, timestamp, payload: encryptedPayload }),
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

      // HUIDU response shape: { code:0, msg:"Success", payload:{ game_launch_url:"..." } }
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

  return json200({ code: 1, msg: 'Not found' })
})
