// HUIDU Gaming API — Game Launch Edge Function
// AES-256 ECB + PKCS7 Padding (as required by HUIDU spec)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const AGENCY_UID    = '2c38947f4e36d6c7685583fa20e3acbf'
const AES_KEY       = '479060999a47a3a311ba5ad48032a5e0'
const PLAYER_PREFIX = 'he0cd4'
const SERVER_URL    = 'https://jsgame.live'
const HOME_URL      = 'https://diamond-bett.vercel.app'

// ─── AES-256 ECB + PKCS7 using Web Crypto (Deno compatible) ──────────────────
// Web Crypto doesn't support ECB natively, so we implement ECB via CBC with zero IV
async function encryptAES256ECB(plaintext: string, keyHex: string): Promise<string> {
  const enc = new TextEncoder()

  // PKCS7 padding
  const data = enc.encode(plaintext)
  const blockSize = 16
  const padLen = blockSize - (data.length % blockSize)
  const padded = new Uint8Array(data.length + padLen)
  padded.set(data)
  padded.fill(padLen, data.length)

  // Import AES key
  const keyBytes = hexToBytes(keyHex)
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes,
    { name: 'AES-CBC' },
    false,
    ['encrypt']
  )

  // ECB = encrypt each 16-byte block independently with zero IV trick:
  // We encrypt each block using CBC with previous ciphertext block as IV (ECB mode manually)
  const blocks = padded.length / blockSize
  const result = new Uint8Array(padded.length)

  for (let i = 0; i < blocks; i++) {
    const block  = padded.slice(i * blockSize, (i + 1) * blockSize)
    // For ECB: XOR with zeros before each encrypt (CBC with zero IV for each block independently)
    const zeroIV = new Uint8Array(16)
    const enc16  = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: zeroIV }, cryptoKey, block)
    // CBC produces 32 bytes (16 encrypted + 16 padding block) — take only first 16
    result.set(new Uint8Array(enc16).slice(0, 16), i * blockSize)
  }

  // Base64 encode
  return btoa(String.fromCharCode(...result))
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

// ─── CORS Headers ─────────────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const url = new URL(req.url)

  // ── POST /api/games/launch ──────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname.endsWith('/games/launch')) {
    try {
      const body = await req.json()
      const { user_id, game_uid, platform = 2, lang = 'my', currency = 'MMK' } = body

      if (!user_id || !game_uid) {
        return Response.json(
          { code: 1, msg: 'Missing user_id or game_uid' },
          { status: 400, headers: corsHeaders }
        )
      }

      // Get user info from DB
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

      if (userErr || !user) {
        return Response.json(
          { code: 1, msg: 'User not found' },
          { status: 404, headers: corsHeaders }
        )
      }

      // Build member_account: player_prefix + phone (no spaces/special chars)
      const cleanPhone   = (user.phone || '').replace(/\D/g, '').slice(-8)
      const memberAcct   = `${PLAYER_PREFIX}_${user_id.replace(/-/g,'').slice(0,10)}`
      const creditAmount = Math.max(parseFloat(user.balance || '0'), 0)
      const timestamp    = Date.now()

      // Build payload JSON
      const payloadObj = {
        timestamp,
        agency_uid    : AGENCY_UID,
        member_account: memberAcct,
        game_uid,
        credit_amount : creditAmount,
        currency_code : 'MMK',
        language      : 'zh',    // HUIDU: zh=Myanmar context, en=English
        home_url      : HOME_URL,
        platform,                // 2 = H5/Mobile
      }

      // AES-256 ECB encrypt
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

      // HUIDU returns: { code, msg, game_url } or { code, msg, data: { game_url } }
      if (huiduData.code !== 0) {
        return Response.json(
          { code: huiduData.code ?? 1, msg: huiduData.msg || huiduData.message || 'HUIDU API error' },
          { status: 200, headers: corsHeaders }
        )
      }

      const gameUrl = huiduData.game_url
        || huiduData.data?.game_url
        || huiduData.data?.url
        || huiduData.url

      return Response.json(
        { code: 0, game_url: gameUrl },
        { status: 200, headers: corsHeaders }
      )

    } catch (err) {
      return Response.json(
        { code: 1, msg: `Server error: ${err}` },
        { status: 500, headers: corsHeaders }
      )
    }
  }

  return Response.json({ code: 1, msg: 'Not found' }, { status: 404, headers: corsHeaders })
})
