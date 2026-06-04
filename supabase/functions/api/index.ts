// HUIDU Gaming API — Game Launch + Seamless Wallet Callback
// AES-256-ECB + PKCS7  (key = raw UTF-8 string, 32 bytes)
//
// FIX (2026-06-03): Replaced broken WebCrypto AES-CBC-as-ECB workaround with
// crypto-js (proper AES-ECB support).
//
// FIX (2026-06-04): Added URL-query member_account fallback for POST callbacks,
// URL-decode payload before decrypt, and dual response format (top-level + payload obj)
// to handle HUIDU V3 callback format variations.
//
// FIX (2026-06-04 v2): Balance values now always integer (Math.round) — MMK has no
// decimal units. Debit/credit responses now include before_balance per HUIDU V3 spec.
// Null-safe balance parsing throughout. member_account case-insensitive fallback added.
//
// FIX (2026-06-04 v3): CRITICAL — Added credit_amount to callback response body.
// HUIDU reads "credit_amount" as the balance field (not "balance"). Without it,
// HUIDU sees balance=0 on every spin → "Add Funds" error even with K1,000,000.
// Also added credit_amount to all afterBalRaw / newBalanceRaw lookup chains so
// HUIDU's incoming credit_amount field is correctly parsed as the post-tx balance.
//
// CALLBACK DESIGN:
//   GET  /games/callback?payload=<enc>&member_account=<ma>  → balance query
//   POST /games/callback  action=balance  → balance query
//   POST /games/callback  action=debit    → deduct bet, return new balance
//   POST /games/callback  action=credit   → add win, return new balance
//   POST /games/callback  (no action)     → session-end sync (set balance directly)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import CryptoJS from 'https://esm.sh/crypto-js@4.2.0'

// ── Production credentials (V3-DiamodBETT-260601) ──────────────────────────
const AGENCY_UID    = '31ce96cb1fbe80b35b4917ba95627d64'
const AES_KEY_STR   = '526bedff1dc3050b0513ff20f0b775e5'  // 32 chars = AES-256
const PLAYER_PREFIX = 'hdf801'
const SERVER_URL    = 'http://216.73.158.42:3000'
const PROXY_SECRET  = 'dbet_proxy_k9x2mw7q'
const HOME_URL      = 'https://diamond-bett.vercel.app'
const CALLBACK_URL  = 'https://xjqrwcsxiaybpztzestb.supabase.co/functions/v1/api/games/callback'

// ─── Debug Logger ─────────────────────────────────────────────────────────────
function dbg(tag: string, data?: unknown) {
  const ts = new Date().toISOString()
  if (data !== undefined) {
    console.log(`[DBG ${ts}] [${tag}]`, typeof data === 'string' ? data : JSON.stringify(data))
  } else {
    console.log(`[DBG ${ts}] [${tag}]`)
  }
}

// ─── AES-256-ECB + PKCS7 via crypto-js ────────────────────────────────────────
function aes256EcbEncryptBase64(plaintext: string, keyStr: string): string {
  const key = CryptoJS.enc.Utf8.parse(keyStr)
  const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  })
  return encrypted.toString()
}

function aes256EcbDecryptBase64(base64: string, keyStr: string): string {
  const key = CryptoJS.enc.Utf8.parse(keyStr)
  const cipherParams = CryptoJS.lib.CipherParams.create({
    ciphertext: CryptoJS.enc.Base64.parse(base64),
  })
  const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  })
  return decrypted.toString(CryptoJS.enc.Utf8)
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

// Safely parse a balance value to an integer (MMK has no sub-unit).
// Handles: number, string, null, undefined, NaN.
function parseBal(val: unknown): number {
  if (val === null || val === undefined) return 0
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  if (!isFinite(n)) return 0
  return Math.round(n)   // MMK — always integer kyats
}

// Balance response — always integer, includes both top-level and payload formats.
// Also includes before_balance for debit/credit per HUIDU V3 spec.
function balanceResp(code: number, balance: number, msg?: string, beforeBalance?: number) {
  if (code !== 0) return json200({ code, msg: msg ?? 'error' })
  const bal = Math.round(balance)
  // Include BOTH "balance" (generic) AND "credit_amount" (HUIDU's field name).
  // HUIDU reads "credit_amount" from our response — without it, HUIDU sees 0
  // and shows "Add Funds" even when the player has money. This was the root cause
  // of the spin → "TO PLACE THIS BET, ADD FUNDS TO YOUR ACCOUNT" bug.
  const body: Record<string, unknown> = {
    code: 0,
    balance: bal,
    credit_amount: bal,          // ← HUIDU's required field name
    currency_code: 'MMK',
    payload: { balance: bal, credit_amount: bal, currency_code: 'MMK' },
  }
  if (beforeBalance !== undefined) {
    body.before_balance = Math.round(beforeBalance)
  }
  return json200(body)
}

function makeSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )
}

// ── Look up user row by member_account ────────────────────────────────────────
// Handles three formats HUIDU may send:
//   hdf801abc123def4   (new format — no underscore, compliant with spec)
//   hdf801_abc123def4  (old format — has underscore, stored in early accounts)
type UserRow = { id: string; balance: number }

async function findUserByMemberAcct(
  supabase: ReturnType<typeof makeSupabase>,
  memberAcct: string
): Promise<UserRow | null> {
  // 1. Direct lookup — exact match
  const { data, error } = await supabase
    .from('users')
    .select('id, balance')
    .eq('member_account', memberAcct)
    .single()

  if (!error && data) {
    return { id: data.id, balance: parseBal(data.balance) }
  }

  dbg('FIND_USER_TRY_ALT', { memberAcct, err: error?.message })

  // 2. Try alternate format:
  //    If we received no-underscore form (hdf801abc123) → also try hdf801_abc123
  //    If we received underscore form (hdf801_abc123)   → also try hdf801abc123
  const altAcct = memberAcct.includes('_')
    ? memberAcct.replace('_', '')                        // strip underscore
    : memberAcct.replace(PLAYER_PREFIX, `${PLAYER_PREFIX}_`)  // add underscore

  if (altAcct !== memberAcct) {
    const { data: d2, error: e2 } = await supabase
      .from('users')
      .select('id, balance')
      .eq('member_account', altAcct)
      .single()

    if (!e2 && d2) {
      dbg('FIND_USER_ALT_MATCH', { altAcct })
      return { id: d2.id, balance: parseBal(d2.balance) }
    }
  }

  dbg('FIND_USER_FALLBACK_SCAN', { memberAcct })

  // 3. UUID-prefix scan — last resort for accounts created before member_account column existed
  //    Strip prefix (with or without underscore) to get the 10-char hex suffix
  const suffix = memberAcct
    .replace(`${PLAYER_PREFIX}_`, '')
    .replace(PLAYER_PREFIX, '')
    .toLowerCase()
    .slice(0, 10)

  const { data: all } = await supabase.from('users').select('id, balance')
  const found = (all ?? []).find((u: { id: string; balance: unknown }) =>
    u.id.replace(/-/g, '').slice(0, 10).toLowerCase() === suffix
  )
  if (!found) return null

  // Back-fill member_account (new format — no underscore) so next lookup is fast
  const canonical = `${PLAYER_PREFIX}${found.id.replace(/-/g, '').slice(0, 10)}`
  await supabase.from('users').update({ member_account: canonical }).eq('id', found.id)
  dbg('FIND_USER_BACKFILL', { canonical })
  return { id: found.id, balance: parseBal(found.balance) }
}

// ── Decrypt HUIDU payload — handles URL-encoded and standard base64 ───────────
function decryptPayload(raw: string): Record<string, unknown> | null {
  try {
    const normalized = decodeURIComponent(raw.replace(/ /g, '+'))
    const dec = aes256EcbDecryptBase64(normalized, AES_KEY_STR)
    if (!dec || dec.length === 0) {
      dbg('DECRYPT_EMPTY', { rawLen: raw.length })
      return null
    }
    return JSON.parse(dec) as Record<string, unknown>
  } catch (_e1) {
    try {
      const dec = aes256EcbDecryptBase64(raw, AES_KEY_STR)
      if (dec && dec.length > 0) return JSON.parse(dec) as Record<string, unknown>
    } catch { /* ignore */ }
    dbg('DECRYPT_FAIL', String(_e1))
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
      const { user_id, game_uid, platform = 2, lang = 'my' } = body

      dbg('LAUNCH_REQ', { user_id, game_uid, platform, lang })

      if (!user_id || !game_uid)
        return json200({ code: 1, msg: 'Missing user_id or game_uid' })

      const supabase = makeSupabase()

      const { data: user, error: userErr } = await supabase
        .from('users')
        .select('balance, phone, member_account')
        .eq('id', user_id)
        .single()

      if (userErr || !user) {
        dbg('LAUNCH_USER_NOT_FOUND', { user_id, err: userErr?.message })
        return json200({ code: 1, msg: 'User not found' })
      }

      // member_account: no underscore — HUIDU spec allows only a-z and 0-9
      // Old accounts may have underscore (hdf801_xxx); new ones use hdf801xxx
      const memberAcct = user.member_account
        ?? `${PLAYER_PREFIX}${user_id.replace(/-/g, '').slice(0, 10)}`

      // CRITICAL: credit_amount must be an integer for MMK.
      // Supabase returns numeric columns as strings — parseBal() handles this safely.
      const creditAmount = parseBal(user.balance)

      const timestamp = Date.now()  // milliseconds — HUIDU requires ms per spec

      dbg('LAUNCH_USER_OK', { memberAcct, rawBalance: user.balance, creditAmount })

      const langMap: Record<string, string> = {
        my: 'my', en: 'en', zh: 'zh', th: 'th', id: 'id', vi: 'vi',
      }
      const language = langMap[lang] ?? 'my'

      const innerPayload = {
        timestamp,
        agency_uid    : AGENCY_UID,
        member_account: memberAcct,
        game_uid,
        credit_amount : creditAmount,   // integer MMK
        currency_code : 'MMK',
        language,
        home_url      : HOME_URL,
        callback_url  : CALLBACK_URL,
        platform,
      }

      dbg('LAUNCH_HUIDU_PAYLOAD', innerPayload)

      const encryptedPayload = aes256EcbEncryptBase64(
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

      dbg('LAUNCH_HUIDU_RESP', huiduData)

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

      dbg('LAUNCH_OK', { gameUrl: gameUrl.slice(0, 80) + '...' })
      return json200({ code: 0, game_url: gameUrl })

    } catch (err) {
      dbg('LAUNCH_ERROR', String(err))
      return json200({ code: 1, msg: `Server error: ${String(err)}` })
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ROUTE 2 — HUIDU Callback   GET|POST /games/callback
  // ══════════════════════════════════════════════════════════════════════════
  if (url.pathname.endsWith('/games/callback')) {
    dbg('CB_INCOMING', { method: req.method, url: url.pathname + url.search })

    try {
      const supabase = makeSupabase()
      let parsed: Record<string, unknown> = {}
      let rawBody = ''

      const qPayload = url.searchParams.get('payload')
      const qMember  = url.searchParams.get('member_account')
      const qAction  = url.searchParams.get('action')

      if (req.method === 'GET') {
        dbg('CB_GET_PARAMS', { hasPayload: !!qPayload, member_account: qMember })

        if (qPayload) {
          const dec = decryptPayload(qPayload)
          if (dec) {
            parsed = dec
            dbg('CB_GET_DECRYPTED', dec)
          } else {
            dbg('CB_GET_DECRYPT_FAIL', { payloadLen: qPayload.length })
          }
        }
        if (qMember && !parsed.member_account) parsed.member_account = qMember
        if (qAction && !parsed.action)         parsed.action         = qAction

      } else if (req.method === 'POST') {
        rawBody = await req.text()
        dbg('CB_POST_RAW_BODY', rawBody.slice(0, 600))

        let body: Record<string, unknown> = {}
        try { body = JSON.parse(rawBody) } catch { body = {} }

        dbg('CB_POST_BODY_KEYS', Object.keys(body))

        if (body.payload && typeof body.payload === 'string') {
          dbg('CB_POST_HAS_ENCRYPTED_PAYLOAD', { payloadLen: (body.payload as string).length })
          const dec = decryptPayload(body.payload as string)
          if (dec) {
            parsed = { ...body, ...dec }
            dbg('CB_POST_DECRYPTED', dec)
          } else {
            parsed = body
            dbg('CB_POST_DECRYPT_FAIL_FALLBACK', body)
          }
        } else {
          parsed = body
          dbg('CB_POST_PLAIN_JSON', body)
        }

        if (qMember && !parsed.member_account) parsed.member_account = qMember
        if (qAction && !parsed.action)         parsed.action         = qAction

      } else {
        return json200({ code: 1, msg: 'Method not allowed' })
      }

      // ── Extract fields ────────────────────────────────────────────────────
      const memberAcct = (
        (parsed.member_account as string | undefined) ??
        (parsed.memberAccount  as string | undefined)
      )
      const action = (
        (parsed.action ?? parsed.type ?? parsed.event ?? '') as string
      ).toLowerCase()

      dbg('CB_PARSED', { memberAcct, action, keys: Object.keys(parsed) })

      if (!memberAcct) {
        dbg('CB_NO_MEMBER_ACCT', { parsed, qMember })
        return json200({ code: 1, msg: 'Missing member_account' })
      }

      const user = await findUserByMemberAcct(supabase, memberAcct)
      if (!user) {
        dbg('CB_USER_NOT_FOUND', { memberAcct })
        return json200({ code: 1, msg: 'User not found: ' + memberAcct })
      }

      const currentBalance = user.balance  // already integer from parseBal()
      dbg('CB_USER_FOUND', { userId: user.id.slice(0, 8) + '...', currentBalance, action })

      // ── BALANCE QUERY ─────────────────────────────────────────────────────
      if (req.method === 'GET' || action === 'balance' || action === 'getbalance' || action === 'get_balance' || action === 'query') {
        dbg('CB_ACTION_BALANCE', { balance: currentBalance })
        return balanceResp(0, currentBalance)
      }

      // ── DEBIT (player places bet) ─────────────────────────────────────────
      if (action === 'debit' || action === 'bet' || action === 'withdraw' || action === 'transfer_out') {
        // credit_amount = HUIDU's post-transaction balance field (same as after_balance)
        const afterBalRaw = parsed.after_balance ?? parsed.afterBalance ?? parsed.after_credit ?? parsed.afterCredit ?? parsed.credit_amount
        const amount = parseBal(parsed.amount ?? parsed.bet_amount ?? parsed.betAmount ?? 0)

        dbg('CB_ACTION_DEBIT', { amount, afterBalRaw, currentBalance })

        if (afterBalRaw !== undefined && afterBalRaw !== null) {
          const newBal = parseBal(afterBalRaw)
          await supabase.from('users').update({ balance: newBal }).eq('id', user.id)
          dbg('CB_DEBIT_OK_AFTER_BAL', { newBal })
          return balanceResp(0, newBal, undefined, currentBalance)
        }
        if (amount > currentBalance) {
          dbg('CB_DEBIT_INSUFFICIENT', { amount, currentBalance })
          return balanceResp(1, currentBalance, 'Insufficient balance')
        }
        const newBal = Math.max(currentBalance - amount, 0)
        await supabase.from('users').update({ balance: newBal }).eq('id', user.id)
        dbg('CB_DEBIT_OK', { amount, newBal })
        return balanceResp(0, newBal, undefined, currentBalance)
      }

      // ── CREDIT (player wins) ──────────────────────────────────────────────
      if (action === 'credit' || action === 'win' || action === 'refund' || action === 'cancel' || action === 'transfer_in') {
        // credit_amount = HUIDU's post-transaction balance field (same as after_balance)
        const afterBalRaw = parsed.after_balance ?? parsed.afterBalance ?? parsed.after_credit ?? parsed.afterCredit ?? parsed.credit_amount
        const amount = parseBal(parsed.amount ?? parsed.win_amount ?? parsed.winAmount ?? 0)

        dbg('CB_ACTION_CREDIT', { amount, afterBalRaw, currentBalance })

        if (afterBalRaw !== undefined && afterBalRaw !== null) {
          const newBal = parseBal(afterBalRaw)
          await supabase.from('users').update({ balance: newBal }).eq('id', user.id)
          dbg('CB_CREDIT_OK_AFTER_BAL', { newBal })
          return balanceResp(0, newBal, undefined, currentBalance)
        }
        const newBal = currentBalance + amount
        await supabase.from('users').update({ balance: newBal }).eq('id', user.id)
        dbg('CB_CREDIT_OK', { amount, newBal })
        return balanceResp(0, newBal, undefined, currentBalance)
      }

      // ── SESSION-END SYNC ──────────────────────────────────────────────────
      const newBalanceRaw = (
        parsed.balance         ??
        parsed.final_balance   ??
        parsed.finalBalance    ??
        parsed.end_balance     ??
        parsed.endBalance      ??
        parsed.after_balance   ??
        parsed.afterBalance    ??
        parsed.after_credit    ??
        parsed.afterCredit     ??
        parsed.credit_amount       // HUIDU's canonical balance field
      )

      dbg('CB_SESSION_END', { newBalanceRaw, allKeys: Object.keys(parsed) })

      if (newBalanceRaw !== undefined && newBalanceRaw !== null) {
        const finalBal = parseBal(newBalanceRaw)
        await supabase.from('users').update({ balance: finalBal }).eq('id', user.id)
        dbg('CB_SESSION_END_OK', { finalBal })
        return balanceResp(0, finalBal, undefined, currentBalance)
      }

      // Unknown action — return current balance (safe default)
      dbg('CB_UNKNOWN_ACTION', { action, parsedFull: parsed })
      return balanceResp(0, currentBalance)

    } catch (err) {
      dbg('CB_ERROR', String(err))
      return json200({ code: 1, msg: `Callback error: ${String(err)}` })
    }
  }

  dbg('NOT_FOUND', { path: url.pathname })
  return json200({ code: 1, msg: 'Not found' })
})
