// HUIDU Gaming API — Game Launch + Seamless/Transfer Wallet Callback
// AES-256-ECB + PKCS7  (key = raw UTF-8 string, 32 bytes)
//
// CALLBACK DESIGN (handles both seamless & transfer wallet):
//   GET  /games/callback?payload=<enc>  → balance query    → { code:0, balance:N }
//   POST /games/callback  action=balance  → balance query
//   POST /games/callback  action=debit    → deduct bet, return new balance
//   POST /games/callback  action=credit   → add win, return new balance
//   POST /games/callback  (no action)     → session-end sync (set balance directly)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

// ── Production credentials (V3-DiamodBETT-260601) ──────────────────────────
const AGENCY_UID    = '31ce96cb1fbe80b35b4917ba95627d64'
const AES_KEY_STR   = '526bedff1dc3050b0513ff20f0b775e5'  // 32 chars = AES-256
const PLAYER_PREFIX = 'hdf801'
const SERVER_URL    = 'http://216.146.26.239:3000'
const PROXY_SECRET  = 'dbet_proxy_k9x2mw7q'
const HOME_URL      = 'https://diamond-bett.vercel.app'
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

  const BLOCK     = 16
  const numBlocks = cipher.length / BLOCK
  const result    = new Uint8Array(cipher.length)
  const zeroIV    = new Uint8Array(BLOCK)

  for (let i = 0; i < numBlocks; i++) {
    const block = cipher.slice(i * BLOCK, (i + 1) * BLOCK)
    const buf   = new Uint8Array(BLOCK * 2)
    buf.set(block, BLOCK)
    const dec = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: zeroIV }, cryptoKey, buf)
    result.set(new Uint8Array(dec).slice(BLOCK), i * BLOCK)
  }

  const padLen = result[result.length - 1]
  return new TextDecoder().decode(result.slice(0, result.length - padLen))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

// ── Look up user row by member_account (fast index path + UUID-prefix fallback)
type UserRow = { id: string; balance: number }

async function findUserByMemberAcct(
  supabase: ReturnType<typeof makeSupabase>,
  memberAcct: string
): Promise<UserRow | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, balance')
    .eq('member_account', memberAcct)
    .single()

  if (!error && data) return data as UserRow

  // Fallback: UUID-prefix scan (pre-migration users)
  const suffix = memberAcct.replace(`${PLAYER_PREFIX}_`, '')
  const { data: all } = await supabase.from('users').select('id, balance')
  const found = (all ?? []).find((u: UserRow) =>
    u.id.replace(/-/g, '').slice(0, 10) === suffix
  )
  if (!found) return null

  // Back-fill member_account for next call
  await supabase.from('users').update({ member_account: memberAcct }).eq('id', found.id)
  return found as UserRow
}

// ── Decrypt HUIDU payload (returns parsed object or null on failure) ──────────
async function decryptPayload(raw: string): Promise<Record<string, unknown> | null> {
  try {
    const dec = await aes256EcbDecryptBase64(raw, AES_KEY_STR)
    return JSON.parse(dec) as Record<string, unknown>
  } catch {
    return null
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: corsHeaders })

  const url = new URL(req.url)

  // ══════════════════════════════════════════════════════════════════════════
  // ROUTE 1 — Game Launch   POST /games/launch
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'POST' && url.pathname.endsWith('/games/launch')) {
    try {
      const body = await req.json()
      const { user_id, game_uid, platform = 2, lang = 'zh' } = body

      if (!user_id || !game_uid)
        return json200({ code: 1, msg: 'Missing user_id or game_uid' })

      const supabase = makeSupabase()

      const { data: user, error: userErr } = await supabase
        .from('users')
        .select('balance, phone, member_account')
        .eq('id', user_id)
        .single()

      if (userErr || !user)
        return json200({ code: 1, msg: 'User not found' })

      const memberAcct   = user.member_account
        ?? `${PLAYER_PREFIX}_${user_id.replace(/-/g, '').slice(0, 10)}`
      const creditAmount = Math.max(parseFloat(String(user.balance ?? '0')) || 0, 0)
      const timestamp    = Math.floor(Date.now() / 1000)

      // Map frontend lang code → HUIDU language code
      const langMap: Record<string, string> = {
        my: 'my', en: 'en', zh: 'zh', th: 'th', id: 'id', vi: 'vi',
      }
      const language = langMap[lang] ?? 'zh'

      const innerPayload = {
        timestamp,
        agency_uid    : AGENCY_UID,
        member_account: memberAcct,
        game_uid,
        credit_amount : creditAmount,
        currency_code : 'MMK',
        language,
        home_url      : HOME_URL,
        callback_url  : CALLBACK_URL,
        platform,
      }

      const encryptedPayload = await aes256EcbEncryptBase64(
        JSON.stringify(innerPayload),
        AES_KEY_STR
      )

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

  // ══════════════════════════════════════════════════════════════════════════
  // ROUTE 2 — HUIDU Callback   GET|POST /games/callback
  //
  // Handles 5 call types HUIDU may send:
  //   GET  ?payload=enc           → balance query
  //   POST action=balance         → balance query
  //   POST action=debit           → real-time bet deduction (seamless wallet)
  //   POST action=credit          → real-time win credit   (seamless wallet)
  //   POST (no action / balance)  → session-end balance sync (transfer wallet)
  // ══════════════════════════════════════════════════════════════════════════
  if (url.pathname.endsWith('/games/callback')) {
    try {
      const supabase = makeSupabase()
      let parsed: Record<string, unknown> = {}

      if (req.method === 'GET') {
        // ── GET: balance query ──────────────────────────────────────────────
        const encParam = url.searchParams.get('payload')
        const maParam  = url.searchParams.get('member_account')

        if (encParam) {
          const dec = await decryptPayload(encParam)
          if (dec) parsed = dec
        }
        if (maParam && !parsed.member_account) parsed.member_account = maParam

      } else if (req.method === 'POST') {
        // ── POST: decrypt body payload ──────────────────────────────────────
        const body = await req.json().catch(() => ({})) as Record<string, unknown>

        if (body.payload && typeof body.payload === 'string') {
          const dec = await decryptPayload(body.payload)
          if (dec) parsed = { ...body, ...dec }
          else     parsed = body
        } else {
          parsed = body
        }
      } else {
        return json200({ code: 1, msg: 'Method not allowed' })
      }

      // Extract common fields (handle both snake_case and camelCase)
      const memberAcct = (parsed.member_account as string | undefined)
      const action     = ((parsed.action ?? parsed.type ?? '') as string).toLowerCase()

      if (!memberAcct) return json200({ code: 1, msg: 'Missing member_account' })

      const user = await findUserByMemberAcct(supabase, memberAcct)
      if (!user) return json200({ code: 1, msg: 'User not found: ' + memberAcct })

      const currentBalance = parseFloat(String(user.balance ?? '0')) || 0

      // ── BALANCE QUERY ───────────────────────────────────────────────────
      if (req.method === 'GET' || action === 'balance' || action === 'getbalance' || action === 'get_balance') {
        return json200({ code: 0, balance: currentBalance, currency_code: 'MMK' })
      }

      // ── REAL-TIME DEBIT (player places bet) ─────────────────────────────
      if (action === 'debit' || action === 'bet') {
        // Prefer after_balance if HUIDU provides it (authoritative)
        const afterBal = parsed.after_balance ?? parsed.afterBalance
        if (afterBal !== undefined && afterBal !== null) {
          const newBal = parseFloat(String(afterBal)) || 0
          await supabase.from('users').update({ balance: newBal }).eq('id', user.id)
          return json200({ code: 0, balance: newBal, currency_code: 'MMK' })
        }
        // Fallback: deduct amount from current balance
        const amount = parseFloat(String(parsed.amount ?? parsed.bet_amount ?? 0)) || 0
        if (amount > currentBalance)
          return json200({ code: 1, msg: 'Insufficient balance' })
        const newBal = Math.max(currentBalance - amount, 0)
        await supabase.from('users').update({ balance: newBal }).eq('id', user.id)
        return json200({ code: 0, balance: newBal, currency_code: 'MMK' })
      }

      // ── REAL-TIME CREDIT (player wins) ──────────────────────────────────
      if (action === 'credit' || action === 'win' || action === 'refund' || action === 'cancel') {
        const afterBal = parsed.after_balance ?? parsed.afterBalance
        if (afterBal !== undefined && afterBal !== null) {
          const newBal = parseFloat(String(afterBal)) || 0
          await supabase.from('users').update({ balance: newBal }).eq('id', user.id)
          return json200({ code: 0, balance: newBal, currency_code: 'MMK' })
        }
        const amount = parseFloat(String(parsed.amount ?? parsed.win_amount ?? 0)) || 0
        const newBal = currentBalance + amount
        await supabase.from('users').update({ balance: newBal }).eq('id', user.id)
        return json200({ code: 0, balance: newBal, currency_code: 'MMK' })
      }

      // ── SESSION-END SYNC (transfer wallet — HUIDU sends final balance) ──
      const newBalance = (
        parsed.balance       ??
        parsed.after_balance ??
        parsed.credit_amount ??
        parsed.final_balance
      )
      if (newBalance === undefined || newBalance === null)
        return json200({ code: 1, msg: 'Missing balance field in callback' })

      const finalBal = parseFloat(String(newBalance)) || 0
      const { error: updateErr } = await supabase
        .from('users')
        .update({ balance: finalBal })
        .eq('id', user.id)

      if (updateErr)
        return json200({ code: 1, msg: 'Balance update failed: ' + updateErr.message })

      return json200({ code: 0, balance: finalBal, currency_code: 'MMK' })

    } catch (err) {
      return json200({ code: 1, msg: `Callback error: ${String(err)}` })
    }
  }

  return json200({ code: 1, msg: 'Not found' })
})
