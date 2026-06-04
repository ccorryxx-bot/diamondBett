// HUIDU Gaming API — Game Launch + Seamless Wallet Callback
// AES-256-ECB + PKCS7  (key = raw UTF-8 string, 32 bytes)
//
// FIX v5 (2026-06-04): CRITICAL — Callback response must be AES-256 encrypted.
// Official HUIDU guide requires:
//   { "code": 0, "msg": "", "payload": "<AES256_ECB_encrypted_json>" }
// Previous versions returned plain JSON → HUIDU could not read balance → "Add Funds".
// Also added:
//   - serial_number deduplication (same serial → return code:0 immediately, no DB write)
//   - credit_amount sent as STRING in encrypted payload per spec
//   - member_account: no underscore enforced (4-20 chars, alphanumeric prefix)
//
// CALLBACK DESIGN:
//   GET  /games/callback?payload=<enc>&member_account=<ma>  → balance query
//   POST /games/callback  action=balance  → balance query
//   POST /games/callback  action=debit    → deduct bet, return encrypted balance
//   POST /games/callback  action=credit   → add win, return encrypted balance
//   POST /games/callback  (no action)     → session-end sync

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import CryptoJS from 'https://esm.sh/crypto-js@4.2.0'

// ── Production credentials ──────────────────────────────────────────────────
const AGENCY_UID    = '31ce96cb1fbe80b35b4917ba95627d64'
const AES_KEY_STR   = '526bedff1dc3050b0513ff20f0b775e5'
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

// ─── AES-256-ECB + PKCS7 ─────────────────────────────────────────────────────
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

function parseBal(val: unknown): number {
  if (val === null || val === undefined) return 0
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  if (!isFinite(n)) return 0
  return Math.round(n)
}

// ─── Encrypted Balance Response (Official HUIDU V3 spec) ─────────────────────
// Response MUST be:  { code, msg, payload: AES256_ECB_base64(json) }
// The encrypted json contains credit_amount as STRING per spec.
function balanceResp(code: number, balance: number, msg?: string) {
  if (code !== 0) return json200({ code, msg: msg ?? 'error', payload: '' })
  const bal = Math.round(balance)
  const innerJson = JSON.stringify({
    credit_amount : String(bal),   // HUIDU spec: string
    currency_code : 'MMK',
  })
  const encryptedPayload = aes256EcbEncryptBase64(innerJson, AES_KEY_STR)
  dbg('RESP_ENCRYPTED', { bal, innerJson })
  return json200({
    code   : 0,
    msg    : '',
    payload: encryptedPayload,
  })
}

function makeSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )
}

// ── Look up user by member_account ────────────────────────────────────────────
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

  if (!error && data) {
    return { id: data.id, balance: parseBal(data.balance) }
  }

  dbg('FIND_USER_TRY_ALT', { memberAcct, err: error?.message })

  // Try alternate format (with/without underscore)
  const altAcct = memberAcct.includes('_')
    ? memberAcct.replace('_', '')
    : memberAcct.replace(PLAYER_PREFIX, `${PLAYER_PREFIX}_`)

  if (altAcct !== memberAcct) {
    const { data: d2, error: e2 } = await supabase
      .from('users').select('id, balance').eq('member_account', altAcct).single()
    if (!e2 && d2) {
      dbg('FIND_USER_ALT_MATCH', { altAcct })
      return { id: d2.id, balance: parseBal(d2.balance) }
    }
  }

  dbg('FIND_USER_FALLBACK_SCAN', { memberAcct })

  // UUID-prefix scan — last resort
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

  const canonical = `${PLAYER_PREFIX}${found.id.replace(/-/g, '').slice(0, 10)}`
  await supabase.from('users').update({ member_account: canonical }).eq('id', found.id)
  dbg('FIND_USER_BACKFILL', { canonical })
  return { id: found.id, balance: parseBal(found.balance) }
}

// ── serial_number deduplication ───────────────────────────────────────────────
// Returns true if this serial was already processed (idempotency).
// Stores in callback_log.serial_number — column added on first use via ALTER TABLE.
async function isDuplicateSerial(
  supabase: ReturnType<typeof makeSupabase>,
  serial: string | undefined
): Promise<boolean> {
  if (!serial) return false
  try {
    // Check if serial_number already exists in callback_log
    const { data } = await supabase
      .from('callback_log')
      .select('id')
      .eq('serial_number', serial)
      .limit(1)
      .single()
    if (data?.id) {
      dbg('SERIAL_DUPLICATE', { serial })
      return true
    }
  } catch { /* column may not exist yet — not a duplicate */ }
  return false
}

// ── Decrypt HUIDU payload ─────────────────────────────────────────────────────
function decryptPayload(raw: string): Record<string, unknown> | null {
  try {
    const normalized = decodeURIComponent(raw.replace(/ /g, '+'))
    const dec = aes256EcbDecryptBase64(normalized, AES_KEY_STR)
    if (!dec || dec.length === 0) { dbg('DECRYPT_EMPTY', { rawLen: raw.length }); return null }
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

      // member_account: no underscore — HUIDU allows only a-z 0-9, 4-20 chars
      const rawAcct = user.member_account
        ?? `${PLAYER_PREFIX}${user_id.replace(/-/g, '').slice(0, 10)}`
      const memberAcct = rawAcct.replace(/_/g, '')

      if (user.member_account && user.member_account.includes('_')) {
        supabase.from('users').update({ member_account: memberAcct }).eq('id', user_id)
          .then(() => dbg('LAUNCH_BACKFILL_MEMBER_ACCT', { memberAcct }))
          .catch(() => {})
      }

      const creditAmount = parseBal(user.balance)
      const timestamp = Date.now()

      dbg('LAUNCH_USER_OK', { memberAcct, creditAmount })

      const langMap: Record<string, string> = {
        my: 'my', en: 'en', zh: 'zh', th: 'th', id: 'id', vi: 'vi',
      }

      const innerPayload = {
        timestamp,
        agency_uid    : AGENCY_UID,
        member_account: memberAcct,
        game_uid,
        credit_amount : String(creditAmount),  // string per spec
        currency_code : 'MMK',
        language      : langMap[lang] ?? 'my',
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
        headers: { 'Content-Type': 'application/json', 'x-proxy-secret': PROXY_SECRET },
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

      dbg('LAUNCH_HUIDU_RESP', huiduData)

      if (huiduData.code !== 0)
        return json200({ code: huiduData.code ?? 1, msg: huiduData.msg || huiduData.message || 'Game API error' })

      const gameUrl = (
        huiduData.payload?.game_launch_url ?? huiduData.payload?.url ?? huiduData.payload?.game_url
        ?? huiduData.game_url ?? huiduData.url ?? huiduData.game_launch_url
      )

      if (!gameUrl) return json200({ code: 1, msg: 'No game URL in response' })

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
        if (qPayload) {
          const dec = decryptPayload(qPayload)
          if (dec) { parsed = dec; dbg('CB_GET_DECRYPTED', dec) }
          else      { dbg('CB_GET_DECRYPT_FAIL', { payloadLen: qPayload.length }) }
        }
        if (qMember && !parsed.member_account) parsed.member_account = qMember
        if (qAction && !parsed.action)         parsed.action         = qAction

      } else if (req.method === 'POST') {
        rawBody = await req.text()
        dbg('CB_POST_RAW_BODY', rawBody.slice(0, 600))

        let body: Record<string, unknown> = {}
        try { body = JSON.parse(rawBody) } catch { body = {} }

        if (body.payload && typeof body.payload === 'string') {
          const dec = decryptPayload(body.payload as string)
          if (dec) { parsed = { ...body, ...dec }; dbg('CB_POST_DECRYPTED', dec) }
          else      { parsed = body; dbg('CB_POST_DECRYPT_FAIL_FALLBACK', body) }
        } else {
          parsed = body
          dbg('CB_POST_PLAIN_JSON', body)
        }

        if (qMember && !parsed.member_account) parsed.member_account = qMember
        if (qAction && !parsed.action)         parsed.action         = qAction

      } else {
        return json200({ code: 1, msg: 'Method not allowed', payload: '' })
      }

      // ── Extract fields ────────────────────────────────────────────────────
      const memberAcct = (
        (parsed.member_account as string | undefined) ??
        (parsed.memberAccount  as string | undefined)
      )
      const action = (
        (parsed.action ?? parsed.type ?? parsed.event ?? '') as string
      ).toLowerCase()
      const serialNumber = (parsed.serial_number ?? parsed.serialNumber) as string | undefined

      dbg('CB_PARSED', { memberAcct, action, serialNumber, keys: Object.keys(parsed) })

      if (!memberAcct) {
        dbg('CB_NO_MEMBER_ACCT', { parsed, qMember })
        return json200({ code: 1, msg: 'Missing member_account', payload: '' })
      }

      // ── serial_number idempotency check ──────────────────────────────────
      // If this exact transaction was already processed, return code:0 immediately.
      if (serialNumber && action !== 'balance' && action !== 'getbalance' && action !== 'get_balance' && action !== 'query' && req.method !== 'GET') {
        const isDup = await isDuplicateSerial(supabase, serialNumber)
        if (isDup) {
          dbg('CB_SERIAL_DUP_SKIP', { serialNumber })
          // Find user to return their current balance
          const dupUser = await findUserByMemberAcct(supabase, memberAcct)
          return balanceResp(0, dupUser?.balance ?? 0)
        }
      }

      const user = await findUserByMemberAcct(supabase, memberAcct)

      // ── Diagnostic log ────────────────────────────────────────────────────
      supabase.from('callback_log').insert({
        method        : req.method,
        raw_body      : rawBody.slice(0, 500),
        parsed_member : memberAcct ?? 'MISSING',
        parsed_action : action || 'NONE',
        serial_number : serialNumber ?? null,
        response_code : user ? 0 : 1,
      }).then(() => {}).catch(() => {})

      if (!user) {
        dbg('CB_USER_NOT_FOUND', { memberAcct })
        return json200({ code: 1, msg: 'User not found: ' + memberAcct, payload: '' })
      }

      const currentBalance = user.balance
      dbg('CB_USER_FOUND', { userId: user.id.slice(0, 8) + '...', currentBalance, action })

      // ── BALANCE QUERY ─────────────────────────────────────────────────────
      if (req.method === 'GET' || action === 'balance' || action === 'getbalance' || action === 'get_balance' || action === 'query') {
        dbg('CB_ACTION_BALANCE', { balance: currentBalance })
        return balanceResp(0, currentBalance)
      }

      // ── DEBIT (player places bet) ─────────────────────────────────────────
      // NOTE: credit_amount in HUIDU debit callback = bet amount, NOT after-balance.
      // Only trust explicit after_balance / after_credit fields.
      if (action === 'debit' || action === 'bet' || action === 'withdraw' || action === 'transfer_out') {
        const afterBalRaw = parsed.after_balance ?? parsed.afterBalance ?? parsed.after_credit ?? parsed.afterCredit
        const amount = parseBal(parsed.amount ?? parsed.bet_amount ?? parsed.betAmount ?? 0)

        dbg('CB_ACTION_DEBIT', { amount, afterBalRaw, currentBalance })

        if (afterBalRaw !== undefined && afterBalRaw !== null) {
          const newBal = parseBal(afterBalRaw)
          await supabase.from('users').update({ balance: newBal }).eq('id', user.id)
          dbg('CB_DEBIT_OK_AFTER_BAL', { newBal })
          return balanceResp(0, newBal)
        }
        if (amount > currentBalance) {
          dbg('CB_DEBIT_INSUFFICIENT', { amount, currentBalance })
          return json200({ code: 1, msg: 'Insufficient balance', payload: '' })
        }
        const newBal = Math.max(currentBalance - amount, 0)
        await supabase.from('users').update({ balance: newBal }).eq('id', user.id)
        dbg('CB_DEBIT_OK', { amount, newBal })
        return balanceResp(0, newBal)
      }

      // ── CREDIT (player wins) ──────────────────────────────────────────────
      // NOTE: credit_amount in HUIDU credit callback = win amount, NOT after-balance.
      if (action === 'credit' || action === 'win' || action === 'refund' || action === 'cancel' || action === 'transfer_in') {
        const afterBalRaw = parsed.after_balance ?? parsed.afterBalance ?? parsed.after_credit ?? parsed.afterCredit
        const amount = parseBal(parsed.amount ?? parsed.win_amount ?? parsed.winAmount ?? 0)

        dbg('CB_ACTION_CREDIT', { amount, afterBalRaw, currentBalance })

        if (afterBalRaw !== undefined && afterBalRaw !== null) {
          const newBal = parseBal(afterBalRaw)
          await supabase.from('users').update({ balance: newBal }).eq('id', user.id)
          dbg('CB_CREDIT_OK_AFTER_BAL', { newBal })
          return balanceResp(0, newBal)
        }
        const newBal = currentBalance + amount
        await supabase.from('users').update({ balance: newBal }).eq('id', user.id)
        dbg('CB_CREDIT_OK', { amount, newBal })
        return balanceResp(0, newBal)
      }

      // ── HUIDU ROUND SUMMARY (no action field) ────────────────────────────
      const hasBetOrWin = (parsed.bet_amount !== undefined || parsed.win_amount !== undefined)
      if (hasBetOrWin) {
        const betAmt = parseBal(parsed.bet_amount ?? 0)
        const winAmt = parseBal(parsed.win_amount ?? 0)
        const net    = winAmt - betAmt
        const newBal = Math.max(currentBalance + net, 0)

        dbg('CB_ROUND_SUMMARY', { betAmt, winAmt, net, currentBalance, newBal, serial: serialNumber })
        await supabase.from('users').update({ balance: newBal }).eq('id', user.id)
        return balanceResp(0, newBal)
      }

      // ── SESSION-END SYNC ──────────────────────────────────────────────────
      const newBalanceRaw = (
        parsed.balance       ?? parsed.final_balance  ?? parsed.finalBalance  ??
        parsed.end_balance   ?? parsed.endBalance     ?? parsed.after_balance  ??
        parsed.afterBalance  ?? parsed.after_credit   ?? parsed.afterCredit    ??
        parsed.credit_amount    // trusted here: session-end final balance field
      )

      dbg('CB_SESSION_END', { newBalanceRaw, allKeys: Object.keys(parsed) })

      if (newBalanceRaw !== undefined && newBalanceRaw !== null) {
        const finalBal = parseBal(newBalanceRaw)
        await supabase.from('users').update({ balance: finalBal }).eq('id', user.id)
        dbg('CB_SESSION_END_OK', { finalBal })
        return balanceResp(0, finalBal)
      }

      dbg('CB_UNKNOWN_ACTION', { action, parsedFull: parsed })
      return balanceResp(0, currentBalance)

    } catch (err) {
      dbg('CB_ERROR', String(err))
      return json200({ code: 1, msg: `Callback error: ${String(err)}`, payload: '' })
    }
  }

  dbg('NOT_FOUND', { path: url.pathname })
  return json200({ code: 1, msg: 'Not found', payload: '' })
})
