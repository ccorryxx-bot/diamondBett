// HUIDU Gaming API — Game Launch + Seamless Wallet Callback + Admin API
// AES-256-ECB + PKCS7  (key = raw UTF-8 string, 32 bytes)
//
// FIX v6 (2026-06-04):
//   - Added POST /admin/process-tx  — secure admin transaction processing
//     (uses service role, protected by x-admin-secret header)
//   - All v5 fixes kept (encrypted callback response, serial dedup, credit_amount string)
//
// ROUTES:
//   POST /games/launch           → launch HUIDU game
//   GET|POST /games/callback     → HUIDU wallet callback (balance/debit/credit)
//   POST /admin/process-tx       → admin approve/reject transaction  [NEW]

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import CryptoJS from 'https://esm.sh/crypto-js@4.2.0'

// ── Production credentials ──────────────────────────────────────────────────
const AGENCY_UID     = '31ce96cb1fbe80b35b4917ba95627d64'
const AES_KEY_STR    = '526bedff1dc3050b0513ff20f0b775e5'
const PLAYER_PREFIX  = 'hdf801'
const SERVER_URL     = 'http://216.73.158.42:3000'
const PROXY_SECRET   = 'dbet_proxy_k9x2mw7q'
const ADMIN_SECRET   = 'dbet_admin_k9x2mw7q'
const HOME_URL       = 'https://diamond-bett.vercel.app'
const CALLBACK_URL   = 'https://xjqrwcsxiaybpztzestb.supabase.co/functions/v1/api/games/callback'

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
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-admin-secret',
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
function balanceResp(code: number, balance: number, msg?: string) {
  if (code !== 0) return json200({ code, msg: msg ?? 'error', payload: '' })
  const bal = Math.round(balance)
  const innerJson = JSON.stringify({
    credit_amount: String(bal),
    currency_code: 'MMK',
  })
  const encryptedPayload = aes256EcbEncryptBase64(innerJson, AES_KEY_STR)
  dbg('RESP_ENCRYPTED', { bal, innerJson })
  return json200({ code: 0, msg: '', payload: encryptedPayload })
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

  if (!error && data) return { id: data.id, balance: parseBal(data.balance) }

  const altAcct = memberAcct.includes('_')
    ? memberAcct.replace('_', '')
    : memberAcct.replace(PLAYER_PREFIX, `${PLAYER_PREFIX}_`)

  if (altAcct !== memberAcct) {
    const { data: d2, error: e2 } = await supabase
      .from('users').select('id, balance').eq('member_account', altAcct).single()
    if (!e2 && d2) return { id: d2.id, balance: parseBal(d2.balance) }
  }

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
  return { id: found.id, balance: parseBal(found.balance) }
}

// ── serial_number deduplication ───────────────────────────────────────────────
async function isDuplicateSerial(
  supabase: ReturnType<typeof makeSupabase>,
  serial: string | undefined
): Promise<boolean> {
  if (!serial) return false
  try {
    const { data } = await supabase
      .from('callback_log')
      .select('id')
      .eq('serial_number', serial)
      .limit(1)
      .single()
    if (data?.id) { dbg('SERIAL_DUPLICATE', { serial }); return true }
  } catch { /* column may not exist yet */ }
  return false
}

// ── Decrypt HUIDU payload ─────────────────────────────────────────────────────
function decryptPayload(raw: string): Record<string, unknown> | null {
  try {
    const normalized = decodeURIComponent(raw.replace(/ /g, '+'))
    const dec = aes256EcbDecryptBase64(normalized, AES_KEY_STR)
    if (!dec || dec.length === 0) return null
    return JSON.parse(dec) as Record<string, unknown>
  } catch (_e1) {
    try {
      const dec = aes256EcbDecryptBase64(raw, AES_KEY_STR)
      if (dec && dec.length > 0) return JSON.parse(dec) as Record<string, unknown>
    } catch { /* ignore */ }
    return null
  }
}

// ─── ADMIN: Process Transaction ───────────────────────────────────────────────
// POST /admin/process-tx
// Header: x-admin-secret: <ADMIN_SECRET>
// Body: { id, uid, type, amount, status, admin_note?, admin_id? }
//
// Uses service role (no RLS) — secure because protected by x-admin-secret header.
// Handles deposit/withdrawal balance updates, bonus, commission, turnover.
async function handleAdminProcessTx(req: Request): Promise<Response> {
  // ── Auth check ────────────────────────────────────────────────────────
  const secret = req.headers.get('x-admin-secret')
  if (secret !== ADMIN_SECRET) {
    dbg('ADMIN_AUTH_FAIL', { provided: secret?.slice(0, 5) + '...' })
    return json200({ code: 401, msg: 'Unauthorized' })
  }

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return json200({ code: 400, msg: 'Invalid JSON body' }) }

  const { id, uid, type, amount, status, admin_note, admin_id } = body as {
    id: string; uid: string; type: string
    amount: number; status: string
    admin_note?: string; admin_id?: string
  }

  if (!id || !uid || !type || !status) {
    return json200({ code: 400, msg: 'Missing required fields: id, uid, type, status' })
  }

  dbg('ADMIN_TX_START', { id, uid: uid.slice(0, 8) + '...', type, amount, status })

  const supabase = makeSupabase()
  const now      = new Date().toISOString()
  const adminBy  = admin_id || 'admin'

  try {
    if (status === 'rejected') {
      // ── REJECT ──────────────────────────────────────────────────────────
      const { error } = await supabase.from('transactions').update({
        status,
        admin_note   : admin_note || null,
        processed_at : now,
        processed_by : adminBy,
      }).eq('id', id)
      if (error) throw error
      dbg('ADMIN_TX_REJECTED', { id })
      return json200({ code: 0, msg: 'ငြင်းပယ်ပြီ' })
    }

    if (status !== 'approved') {
      return json200({ code: 400, msg: 'status must be approved or rejected' })
    }

    // ── APPROVE ────────────────────────────────────────────────────────────
    // Fetch user profile + site settings in parallel (graceful defaults)
    const [profileRes, settingsRes] = await Promise.all([
      supabase.from('users')
        .select('balance, remaining_turnover, total_deposited, total_withdrawn, referrer_id')
        .eq('id', uid)
        .single(),
      supabase.from('site_settings')
        .select('deposit_bonus_rate, turnover_multiplier, commission_enabled, commission_rate')
        .eq('id', 1)
        .maybeSingle(),
    ])

    if (profileRes.error || !profileRes.data) {
      dbg('ADMIN_TX_USER_NOT_FOUND', { uid, err: profileRes.error?.message })
      return json200({ code: 404, msg: 'User not found: ' + (profileRes.error?.message || uid) })
    }

    const profile  = profileRes.data
    // Safe defaults for site_settings (columns may not exist yet)
    const sets     = settingsRes.data ?? {}
    const bonusRate  = parseFloat((sets as Record<string,unknown>).deposit_bonus_rate as string  || '0') || 0
    const turnoverX  = parseFloat((sets as Record<string,unknown>).turnover_multiplier as string || '10') || 10
    const commEnabled= !!((sets as Record<string,unknown>).commission_enabled)
    const commRate   = parseFloat((sets as Record<string,unknown>).commission_rate as string     || '0') || 0

    let newBal = parseBal(profile.balance)
    let newTO  = parseBal(profile.remaining_turnover)
    let newDep = parseBal(profile.total_deposited)
    let newWd  = parseBal(profile.total_withdrawn)

    if (type === 'deposit') {
      const bonus = amount * (bonusRate / 100)
      newBal += amount + bonus
      newTO  += amount * turnoverX
      newDep += amount

      dbg('ADMIN_TX_DEPOSIT', { amount, bonus, newBal, newTO })

      // Commission to referrer (if enabled)
      if (commEnabled && commRate > 0 && profile.referrer_id) {
        let referrerId: string | null = profile.referrer_id as string
        // Handle ref_code vs UUID
        if (referrerId && referrerId.length < 20) {
          const { data: ref } = await supabase
            .from('users').select('id').eq('ref_code', referrerId).single()
          referrerId = ref?.id || null
        }
        if (referrerId) {
          const commAmt = amount * (commRate / 100)
          const { data: referrer } = await supabase
            .from('users').select('balance').eq('id', referrerId).single()
          if (referrer) {
            const newRefBal = parseBal(referrer.balance) + commAmt
            await Promise.all([
              supabase.from('users').update({ balance: newRefBal }).eq('id', referrerId),
              supabase.from('commissions').insert({
                agent_id      : referrerId,
                user_id       : uid,
                transaction_id: id,
                amount        : commAmt,
                percentage    : commRate,
                level         : 1,
                type          : 'deposit',
                created_at    : now,
              }),
            ])
            dbg('ADMIN_TX_COMMISSION', { commAmt, referrerId: referrerId.slice(0, 8) + '...' })
          }
        }
      }

    } else if (type === 'withdrawal') {
      newBal = Math.max(newBal - amount, 0)
      newWd  += amount
      dbg('ADMIN_TX_WITHDRAWAL', { amount, newBal })
    }

    // ── Update user balance ──────────────────────────────────────────────
    const { error: balErr } = await supabase.from('users').update({
      balance           : newBal,
      remaining_turnover: newTO,
      total_deposited   : newDep,
      total_withdrawn   : newWd,
      last_login_at     : now,
    }).eq('id', uid)

    if (balErr) throw balErr

    // ── Update transaction status ────────────────────────────────────────
    const { data: origTx } = await supabase
      .from('transactions').select('amount').eq('id', id).single()

    const { error: txErr } = await supabase.from('transactions').update({
      status,
      amount,
      original_amount: origTx?.amount ?? amount,
      admin_note     : admin_note || null,
      processed_at   : now,
      processed_by   : adminBy,
    }).eq('id', id)

    if (txErr) throw txErr

    dbg('ADMIN_TX_APPROVED', { id, uid: uid.slice(0, 8) + '...', newBal })
    return json200({
      code    : 0,
      msg     : `${amount.toLocaleString()} K အတည်ပြုပြီ`,
      new_balance: newBal,
    })

  } catch (err) {
    dbg('ADMIN_TX_ERROR', String(err))
    return json200({ code: 500, msg: `Server error: ${String(err)}` })
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: corsHeaders })

  const url = new URL(req.url)

  // ══════════════════════════════════════════════════════════════════════════
  // ROUTE: Admin process transaction  POST /admin/process-tx
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'POST' && url.pathname.endsWith('/admin/process-tx')) {
    return handleAdminProcessTx(req)
  }

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

      const rawAcct   = user.member_account ?? `${PLAYER_PREFIX}${user_id.replace(/-/g, '').slice(0, 10)}`
      const memberAcct = rawAcct.replace(/_/g, '')

      if (user.member_account && user.member_account.includes('_')) {
        supabase.from('users').update({ member_account: memberAcct }).eq('id', user_id)
          .then(() => dbg('LAUNCH_BACKFILL_MEMBER_ACCT', { memberAcct }))
          .catch(() => {})
      }

      const creditAmount = parseBal(user.balance)
      const timestamp    = Date.now()

      const langMap: Record<string, string> = {
        my: 'my', en: 'en', zh: 'zh', th: 'th', id: 'id', vi: 'vi',
      }

      const innerPayload = {
        timestamp,
        agency_uid    : AGENCY_UID,
        member_account: memberAcct,
        game_uid,
        credit_amount : String(creditAmount),
        currency_code : 'MMK',
        language      : langMap[lang] ?? 'my',
        home_url      : HOME_URL,
        callback_url  : CALLBACK_URL,
        platform,
      }

      const encryptedPayload = aes256EcbEncryptBase64(JSON.stringify(innerPayload), AES_KEY_STR)

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
          if (dec) parsed = dec
        }
        if (qMember && !parsed.member_account) parsed.member_account = qMember
        if (qAction && !parsed.action)         parsed.action         = qAction

      } else if (req.method === 'POST') {
        rawBody = await req.text()

        let body: Record<string, unknown> = {}
        try { body = JSON.parse(rawBody) } catch { body = {} }

        if (body.payload && typeof body.payload === 'string') {
          const dec = decryptPayload(body.payload as string)
          if (dec) parsed = { ...body, ...dec }
          else     parsed = body
        } else {
          parsed = body
        }

        if (qMember && !parsed.member_account) parsed.member_account = qMember
        if (qAction && !parsed.action)         parsed.action         = qAction

      } else {
        return json200({ code: 1, msg: 'Method not allowed', payload: '' })
      }

      const memberAcct  = (parsed.member_account as string | undefined) ?? (parsed.memberAccount as string | undefined)
      const action      = ((parsed.action ?? parsed.type ?? parsed.event ?? '') as string).toLowerCase()
      const serialNumber = (parsed.serial_number ?? parsed.serialNumber) as string | undefined

      dbg('CB_PARSED', { memberAcct, action, serialNumber, keys: Object.keys(parsed) })

      if (!memberAcct) return json200({ code: 1, msg: 'Missing member_account', payload: '' })

      // ── serial_number idempotency ─────────────────────────────────────────
      const isBalanceQuery = req.method === 'GET' || action === 'balance' || action === 'getbalance' || action === 'get_balance' || action === 'query'
      if (serialNumber && !isBalanceQuery) {
        const isDup = await isDuplicateSerial(supabase, serialNumber)
        if (isDup) {
          const dupUser = await findUserByMemberAcct(supabase, memberAcct)
          return balanceResp(0, dupUser?.balance ?? 0)
        }
      }

      const user = await findUserByMemberAcct(supabase, memberAcct)

      // Diagnostic log (fire and forget)
      supabase.from('callback_log').insert({
        method        : req.method,
        raw_body      : rawBody.slice(0, 500),
        parsed_member : memberAcct ?? 'MISSING',
        parsed_action : action || 'NONE',
        serial_number : serialNumber ?? null,
        response_code : user ? 0 : 1,
      }).then(() => {}).catch(() => {})

      if (!user) return json200({ code: 1, msg: 'User not found: ' + memberAcct, payload: '' })

      const currentBalance = user.balance
      dbg('CB_USER_FOUND', { userId: user.id.slice(0, 8) + '...', currentBalance, action })

      // ── BALANCE QUERY ─────────────────────────────────────────────────────
      if (isBalanceQuery) return balanceResp(0, currentBalance)

      // ── DEBIT ─────────────────────────────────────────────────────────────
      if (action === 'debit' || action === 'bet' || action === 'withdraw' || action === 'transfer_out') {
        const afterBalRaw = parsed.after_balance ?? parsed.afterBalance ?? parsed.after_credit ?? parsed.afterCredit
        const amount = parseBal(parsed.amount ?? parsed.bet_amount ?? parsed.betAmount ?? 0)

        if (afterBalRaw !== undefined && afterBalRaw !== null) {
          const newBal = parseBal(afterBalRaw)
          await supabase.from('users').update({ balance: newBal }).eq('id', user.id)
          return balanceResp(0, newBal)
        }
        if (amount > currentBalance) return json200({ code: 1, msg: 'Insufficient balance', payload: '' })
        const newBal = Math.max(currentBalance - amount, 0)
        await supabase.from('users').update({ balance: newBal }).eq('id', user.id)
        return balanceResp(0, newBal)
      }

      // ── CREDIT ────────────────────────────────────────────────────────────
      if (action === 'credit' || action === 'win' || action === 'refund' || action === 'cancel' || action === 'transfer_in') {
        const afterBalRaw = parsed.after_balance ?? parsed.afterBalance ?? parsed.after_credit ?? parsed.afterCredit
        const amount = parseBal(parsed.amount ?? parsed.win_amount ?? parsed.winAmount ?? 0)

        if (afterBalRaw !== undefined && afterBalRaw !== null) {
          const newBal = parseBal(afterBalRaw)
          await supabase.from('users').update({ balance: newBal }).eq('id', user.id)
          return balanceResp(0, newBal)
        }
        const newBal = currentBalance + amount
        await supabase.from('users').update({ balance: newBal }).eq('id', user.id)
        return balanceResp(0, newBal)
      }

      // ── ROUND SUMMARY ─────────────────────────────────────────────────────
      const hasBetOrWin = (parsed.bet_amount !== undefined || parsed.win_amount !== undefined)
      if (hasBetOrWin) {
        const betAmt = parseBal(parsed.bet_amount ?? 0)
        const winAmt = parseBal(parsed.win_amount ?? 0)
        const newBal = Math.max(currentBalance + (winAmt - betAmt), 0)
        await supabase.from('users').update({ balance: newBal }).eq('id', user.id)
        return balanceResp(0, newBal)
      }

      // ── SESSION-END SYNC ──────────────────────────────────────────────────
      const newBalanceRaw = (
        parsed.balance      ?? parsed.final_balance ?? parsed.finalBalance  ??
        parsed.end_balance  ?? parsed.endBalance    ?? parsed.after_balance ??
        parsed.afterBalance ?? parsed.after_credit  ?? parsed.afterCredit   ??
        parsed.credit_amount
      )

      if (newBalanceRaw !== undefined && newBalanceRaw !== null) {
        const finalBal = parseBal(newBalanceRaw)
        await supabase.from('users').update({ balance: finalBal }).eq('id', user.id)
        return balanceResp(0, finalBal)
      }

      return balanceResp(0, currentBalance)

    } catch (err) {
      dbg('CB_ERROR', String(err))
      return json200({ code: 1, msg: `Callback error: ${String(err)}`, payload: '' })
    }
  }

  return json200({ code: 1, msg: 'Not found', payload: '' })
})
