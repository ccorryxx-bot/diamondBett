// HUIDU Gaming API — Game Launch Edge Function
// AES-256-ECB + PKCS7  (key = raw UTF-8 string, 32 bytes)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const AGENCY_UID    = '2c38947f4e36d6c7685583fa20e3acbf'
const AES_KEY_STR   = '479060999a47a3a311ba5ad48032a5e0'   // 32 ASCII chars = 32 bytes = AES-256
const PLAYER_PREFIX = 'he0cd4'
const SERVER_URL    = 'https://jsgame.live'
const HOME_URL      = 'https://diamond-bett.vercel.app'

// ─── AES-256 ECB + PKCS7 ─────────────────────────────────────────────────────
// Web Crypto has no native ECB.
// Trick: AES-CBC with all-zero IV encrypts block[0] identically to ECB.
// For subsequent blocks we need to XOR output of previous encrypt back out,
// so we just encrypt each block separately with IV=0 (= ECB for every block).
async function aes256EcbEncryptBase64(plaintext: string, keyStr: string): Promise<string> {
  const enc       = new TextEncoder()
  const keyBytes  = enc.encode(keyStr)          // raw UTF-8 → 32 bytes → AES-256
  const dataBytes = enc.encode(plaintext)

  const BLOCK = 16
  // PKCS7 pad to multiple of 16
  const padLen = BLOCK - (dataBytes.length % BLOCK)
  const padded = new Uint8Array(dataBytes.length + padLen)
  padded.set(dataBytes)
  padded.fill(padLen, dataBytes.length)

  // Import key
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'AES-CBC' }, false, ['encrypt']
  )

  // Encrypt each 16-byte block with IV=0 → identical to AES-ECB
  const numBlocks = padded.length / BLOCK
  const result    = new Uint8Array(padded.length)
  const zeroIV    = new Uint8Array(BLOCK)

  for (let i = 0; i < numBlocks; i++) {
    const block    = padded.slice(i * BLOCK, (i + 1) * BLOCK)
    // AES-CBC(block, iv=0) returns 32 bytes (block + CBC's own padding block)
    // First 16 bytes = AES(block XOR 0) = AES(block) = ECB result ✓
    const enc32    = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: zeroIV }, cryptoKey, block)
    result.set(new Uint8Array(enc32).slice(0, BLOCK), i * BLOCK)
  }

  // Return standard Base64
  return btoa(String.fromCharCode(...result))
}

// ─── CORS ─────────────────────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
}

// Always HTTP 200 — frontend checks result.code, not HTTP status
function json200(body: object) {
  return Response.json(body, { status: 200, headers: corsHeaders })
}

// ─── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: corsHeaders })

  const url = new URL(req.url)

  // POST /api/games/launch
  if (req.method === 'POST' && url.pathname.endsWith('/games/launch')) {
    try {
      const body = await req.json()
      const { user_id, game_uid, platform = 2 } = body

      if (!user_id || !game_uid)
        return json200({ code: 1, msg: 'Missing user_id or game_uid' })

      // Fetch user balance from Supabase (service role bypasses RLS)
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

      // Unique member account per user
      const memberAcct   = `${PLAYER_PREFIX}_${user_id.replace(/-/g, '').slice(0, 10)}`
      // credit_amount: user's current balance (min 0)
      const creditAmount = Math.max(parseFloat(String(user.balance ?? '0')) || 0, 0)
      const timestamp    = Math.floor(Date.now() / 1000)   // UNIX seconds

      // HUIDU inner payload (will be AES-256 ECB encrypted)
      const innerPayload = {
        timestamp,
        agency_uid    : AGENCY_UID,
        member_account: memberAcct,
        game_uid,
        credit_amount : creditAmount,
        currency_code : 'MMK',
        language      : 'zh',
        home_url      : HOME_URL,
        platform,
      }

      const encryptedPayload = await aes256EcbEncryptBase64(
        JSON.stringify(innerPayload),
        AES_KEY_STR
      )

      // HUIDU outer request body
      const huiduBody = {
        agency_uid: AGENCY_UID,
        timestamp,
        payload   : encryptedPayload,
      }

      console.log('HUIDU request body:', JSON.stringify({ ...huiduBody, payload: encryptedPayload.slice(0, 30) + '...' }))

      const huiduResp = await fetch(`${SERVER_URL}/game/v1`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(huiduBody),
      })

      const huiduData = await huiduResp.json()

      console.log('HUIDU response:', JSON.stringify(huiduData))

      if (huiduData.code !== 0)
        return json200({ code: huiduData.code ?? 1, msg: huiduData.msg || huiduData.message || 'Game API error' })

      // Accommodate different game_url field names in response
      const gameUrl = huiduData.game_url
        ?? huiduData.data?.game_url
        ?? huiduData.data?.url
        ?? huiduData.url

      if (!gameUrl)
        return json200({ code: 1, msg: 'No game URL in response' })

      return json200({ code: 0, game_url: gameUrl })

    } catch (err) {
      console.error('Edge function error:', err)
      return json200({ code: 1, msg: `Server error: ${String(err)}` })
    }
  }

  return json200({ code: 1, msg: 'Not found' })
})
