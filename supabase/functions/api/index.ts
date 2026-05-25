// HUIDU Gaming API — Game Launch Edge Function
// AES-256 ECB + PKCS7 Padding (as required by HUIDU spec)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const AGENCY_UID    = '2c38947f4e36d6c7685583fa20e3acbf'
const AES_KEY       = '479060999a47a3a311ba5ad48032a5e0'
const PLAYER_PREFIX = 'he0cd4'
const SERVER_URL    = 'https://jsgame.live'
const HOME_URL      = 'https://diamond-bett.vercel.app'

// ─── AES-256 ECB + PKCS7 using Web Crypto (Deno compatible) ──────────────────
// ECB = encrypt each 16-byte block independently (simulate via CBC with zero IV per block)
async function encryptAES256ECB(plaintext: string, keyHex: string): Promise<string> {
  const enc      = new TextEncoder()
  const data     = enc.encode(plaintext)
  const blockSize = 16

  // PKCS7 padding
  const padLen = blockSize - (data.length % blockSize)
  const padded = new Uint8Array(data.length + padLen)
  padded.set(data)
  padded.fill(padLen, data.length)

  // Import AES-256 key
  const keyBytes = hexToBytes(keyHex)
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'AES-CBC' }, false, ['encrypt']
  )

  // Encrypt each 16-byte block with zero IV → ECB behavior
  const blocks = padded.length / blockSize
  const result = new Uint8Array(padded.length)
  for (let i = 0; i < blocks; i++) {
    const block  = padded.slice(i * blockSize, (i + 1) * blockSize)
    const zeroIV = new Uint8Array(16)
    const enc16  = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: zeroIV }, cryptoKey, block)
    result.set(new Uint8Array(enc16).slice(0, 16), i * blockSize)
  }

  return btoa(String.fromCharCode(...result))
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2)
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  return bytes
}

// ─── CORS Headers ─────────────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
}

// Always HTTP 200 — games.js checks resp.ok first, then result.code
function ok(body: object) {
  return Response.json(body, { status: 200, headers: corsHeaders })
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // Preflight
  if (req.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: corsHeaders })

  const url = new URL(req.url)

  // ── POST /api/games/launch ──────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname.endsWith('/games/launch')) {
    try {
      const body = await req.json()
      const { user_id, game_uid, platform = 2 } = body

      if (!user_id || !game_uid)
        return ok({ code: 1, msg: 'Missing user_id or game_uid' })

      // Get user info from DB using service role
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
        return ok({ code: 1, msg: 'User not found' })

      // member_account: prefix + first 10 chars of UUID (no dashes) — unique per user
      const memberAcct   = `${PLAYER_PREFIX}_${user_id.replace(/-/g, '').slice(0, 10)}`
      const creditAmount = Math.max(parseFloat(user.balance || '0'), 0)
      const timestamp    = Date.now()

      // Build HUIDU payload
      const payloadObj = {
        timestamp,
        agency_uid    : AGENCY_UID,
        member_account: memberAcct,
        game_uid,
        credit_amount : creditAmount,
        currency_code : 'MMK',
        language      : 'zh',
        home_url      : HOME_URL,
        platform,          // 2 = H5/Mobile
      }

      // AES-256 ECB encrypt payload
      const encPayload = await encryptAES256ECB(JSON.stringify(payloadObj), AES_KEY)

      // Call HUIDU Gaming API
      const huiduResp = await fetch(`${SERVER_URL}/game/v1`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          agency_uid: AGENCY_UID,
          timestamp,
          payload   : encPayload,
        }),
      })

      const huiduData = await huiduResp.json()

      // HUIDU error
      if (huiduData.code !== 0)
        return ok({ code: huiduData.code ?? 1, msg: huiduData.msg || huiduData.message || 'HUIDU API error' })

      // Extract game URL (handle different response shapes)
      const gameUrl = huiduData.game_url
        || huiduData.data?.game_url
        || huiduData.data?.url
        || huiduData.url

      return ok({ code: 0, game_url: gameUrl })

    } catch (err) {
      return ok({ code: 1, msg: `Server error: ${err}` })
    }
  }

  return ok({ code: 1, msg: 'Not found' })
})
