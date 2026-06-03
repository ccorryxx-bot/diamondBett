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

  // ─── Debug Logger ─────────────────────────────────────────────────────────────
  // Logs appear in Supabase Dashboard → Edge Functions → api → Logs
  function dbg(tag: string, data?: unknown) {
    const ts = new Date().toISOString()
    if (data !== undefined) {
      console.log(`[DBG ${ts}] [${tag}]`, typeof data === 'string' ? data : JSON.stringify(data))
    } else {
      console.log(`[DBG ${ts}] [${tag}]`)
    }
  }

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
    } catch (e) {
      dbg('DECRYPT_FAIL', String(e))
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

        const memberAcct   = user.member_account
          ?? `${PLAYER_PREFIX}_${user_id.replace(/-/g, '').slice(0, 10)}`
        const creditAmount = Math.max(parseFloat(String(user.balance ?? '0')) || 0, 0)
        const timestamp    = Math.floor(Date.now() / 1000)

        dbg('LAUNCH_USER_OK', { memberAcct, balance: user.balance, creditAmount })

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

        dbg('LAUNCH_HUIDU_PAYLOAD', innerPayload)

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
      // ── LOG EVERY CALLBACK — ဒါ key logging point ──────────────────────────
      dbg('CB_INCOMING', {
        method  : req.method,
        url     : url.pathname + url.search,
        headers : Object.fromEntries([...req.headers.entries()]
          .filter(([k]) => !k.toLowerCase().includes('authorization'))),
      })

      try {
        const supabase = makeSupabase()
        let parsed: Record<string, unknown> = {}
        let rawBody = ''

        if (req.method === 'GET') {
          const encParam = url.searchParams.get('payload')
          const maParam  = url.searchParams.get('member_account')

          dbg('CB_GET_PARAMS', { hasPayload: !!encParam, member_account: maParam })

          if (encParam) {
            const dec = await decryptPayload(encParam)
            if (dec) {
              parsed = dec
              dbg('CB_GET_DECRYPTED', dec)
            } else {
              dbg('CB_GET_DECRYPT_FAIL', { payloadLen: encParam.length })
            }
          }
          if (maParam && !parsed.member_account) parsed.member_account = maParam

        } else if (req.method === 'POST') {
          // Clone request to read body twice (for logging)
          rawBody = await req.text()
          dbg('CB_POST_RAW_BODY', rawBody.slice(0, 500))

          let body: Record<string, unknown> = {}
          try { body = JSON.parse(rawBody) } catch { body = {} }

          dbg('CB_POST_BODY_KEYS', Object.keys(body))

          if (body.payload && typeof body.payload === 'string') {
            dbg('CB_POST_HAS_ENCRYPTED_PAYLOAD', { payloadLen: (body.payload as string).length })
            const dec = await decryptPayload(body.payload as string)
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
        } else {
          dbg('CB_BAD_METHOD', req.method)
          return json200({ code: 1, msg: 'Method not allowed' })
        }

        // Extract fields
        const memberAcct = (parsed.member_account as string | undefined)
        const action     = ((parsed.action ?? parsed.type ?? '') as string).toLowerCase()

        dbg('CB_PARSED', { memberAcct, action, keys: Object.keys(parsed) })

        if (!memberAcct) {
          dbg('CB_NO_MEMBER_ACCT', parsed)
          return json200({ code: 1, msg: 'Missing member_account' })
        }

        const user = await findUserByMemberAcct(supabase, memberAcct)
        if (!user) {
          dbg('CB_USER_NOT_FOUND', { memberAcct })
          return json200({ code: 1, msg: 'User not found: ' + memberAcct })
        }

        const currentBalance = parseFloat(String(user.balance ?? '0')) || 0
        dbg('CB_USER_FOUND', { userId: user.id.slice(0, 8) + '...', currentBalance, action })

        // ── BALANCE QUERY ────────────────────────────────────────────────────
        if (req.method === 'GET' || action === 'balance' || action === 'getbalance' || action === 'get_balance') {
          dbg('CB_ACTION_BALANCE', { balance: currentBalance })
          return json200({ code: 0, balance: currentBalance, currency_code: 'MMK' })
        }

        // ── REAL-TIME DEBIT (player places bet) ──────────────────────────────
        if (action === 'debit' || action === 'bet') {
          const afterBal = parsed.after_balance ?? parsed.afterBalance
          const amount   = parseFloat(String(parsed.amount ?? parsed.bet_amount ?? 0)) || 0

          dbg('CB_ACTION_DEBIT', { amount, afterBal, currentBalance })

          if (afterBal !== undefined && afterBal !== null) {
            const newBal = parseFloat(String(afterBal)) || 0
            await supabase.from('users').update({ balance: newBal }).eq('id', user.id)
            dbg('CB_DEBIT_OK_AFTER_BAL', { newBal })
            return json200({ code: 0, balance: newBal, currency_code: 'MMK' })
          }
          if (amount > currentBalance) {
            dbg('CB_DEBIT_INSUFFICIENT', { amount, currentBalance })
            return json200({ code: 1, msg: 'Insufficient balance' })
          }
          const newBal = Math.max(currentBalance - amount, 0)
          await supabase.from('users').update({ balance: newBal }).eq('id', user.id)
          dbg('CB_DEBIT_OK', { amount, newBal })
          return json200({ code: 0, balance: newBal, currency_code: 'MMK' })
        }

        // ── REAL-TIME CREDIT (player wins) ───────────────────────────────────
        if (action === 'credit' || action === 'win' || action === 'refund' || action === 'cancel') {
          const afterBal = parsed.after_balance ?? parsed.afterBalance
          const amount   = parseFloat(String(parsed.amount ?? parsed.win_amount ?? 0)) || 0

          dbg('CB_ACTION_CREDIT', { amount, afterBal, currentBalance })

          if (afterBal !== undefined && afterBal !== null) {
            const newBal = parseFloat(String(afterBal)) || 0
            await supabase.from('users').update({ balance: newBal }).eq('id', user.id)
            dbg('CB_CREDIT_OK_AFTER_BAL', { newBal })
            return json200({ code: 0, balance: newBal, currency_code: 'MMK' })
          }
          const newBal = currentBalance + amount
          await supabase.from('users').update({ balance: newBal }).eq('id', user.id)
          dbg('CB_CREDIT_OK', { amount, newBal })
          return json200({ code: 0, balance: newBal, currency_code: 'MMK' })
        }

        // ── SESSION-END SYNC (transfer wallet) ───────────────────────────────
        const newBalance = (
          parsed.balance         ??
          parsed.final_balance   ??
          parsed.finalBalance    ??
          parsed.end_balance     ??
          parsed.endBalance      ??
          parsed.after_balance   ??
          parsed.afterBalance
        )

        dbg('CB_SESSION_END', { newBalance, allKeys: Object.keys(parsed) })

        if (newBalance !== undefined && newBalance !== null) {
          const finalBal = parseFloat(String(newBalance)) || 0
          await supabase.from('users').update({ balance: finalBal }).eq('id', user.id)
          dbg('CB_SESSION_END_OK', { finalBal })
          return json200({ code: 0, balance: finalBal, currency_code: 'MMK' })
        }

        // Unknown action — log everything and return current balance
        dbg('CB_UNKNOWN_ACTION', { action, parsedFull: parsed })
        return json200({ code: 0, balance: currentBalance, currency_code: 'MMK' })

      } catch (err) {
        dbg('CB_ERROR', String(err))
        return json200({ code: 1, msg: `Callback error: ${String(err)}` })
      }
    }

    dbg('NOT_FOUND', { path: url.pathname })
    return json200({ code: 1, msg: 'Not found' })
  })
  