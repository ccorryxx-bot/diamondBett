// ============================================================
// FRONTEND REALTIME SUBSCRIPTIONS  (js/realtime.js)
// Provides: subscribeVipRealtime, setupUserRealtime,
//           teardownUserRealtime
// ============================================================

let _balanceSub = null;
let _txSub      = null;
let _agentSub   = null;

// ── subscribeVipRealtime ─────────────────────────────────────
// Called from auth.js onLoginSuccess.
// Subscribes to the users row for live balance + VIP updates.
function subscribeVipRealtime(userId) {
  if (!window.DB || !userId) return;
  if (_balanceSub) { window.DB.removeChannel(_balanceSub); _balanceSub = null; }

  _balanceSub = window.DB
    .channel('user-row-' + userId)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'users', filter: 'id=eq.' + userId },
      function(payload) {
        const row = payload.new;
        if (!row) return;

        var newBal = parseFloat(row.balance || 0);
        var oldBal = parseFloat((payload.old && payload.old.balance != null) ? payload.old.balance : newBal);
        var fmt2   = newBal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // Update all balance display elements
        document.querySelectorAll('#qnavBalance').forEach(function(el) { el.textContent = fmt2; });
        var acctBalEl = document.getElementById('acctHeaderBal');
        if (acctBalEl) acctBalEl.textContent = fmt2;
        if (typeof setEl === 'function') setEl('statBalance', newBal.toFixed(2));

        // Toast only when balance actually changed
        if (Math.abs(newBal - oldBal) > 0.001) {
          var diff = newBal - oldBal;
          var sign = diff > 0 ? '+' : '-';
          var label = diff > 0 ? 'ကျန်ငွေ ထည့်သွင်းပြီး 💰' : 'ကျန်ငွေ ပြောင်းလဲပြီး';
          if (typeof gToast === 'function')
            gToast(label + ' (' + fmt2 + ' ကျပ်)', diff > 0 ? 'success' : 'normal');
        }

        // VIP level refresh when deposit total changes
        var dep = parseFloat(row.total_deposited || 0);
        if (typeof loadUserVip === 'function') loadUserVip(userId, dep);
      }
    )
    .subscribe(function(status, err) {
      if (err) console.error('[RT] balance/vip channel:', err);
    });
}

// ── Transaction status live updates ─────────────────────────
function _subscribeTransactions(userId) {
  if (!window.DB || !userId) return;
  if (_txSub) { window.DB.removeChannel(_txSub); _txSub = null; }

  _txSub = window.DB
    .channel('txn-' + userId)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'transactions', filter: 'user_id=eq.' + userId },
      function(payload) {
        var tx  = payload.new;
        var old = payload.old;
        if (!tx || !tx.status || tx.status === (old && old.status)) return;

        var isDep = tx.type === 'deposit';
        var amt   = parseFloat(tx.amount || 0).toLocaleString();
        var label = isDep ? 'ငွေသွင်း' : 'ငွေထုတ်';

        if (tx.status === 'approved') {
          if (typeof gToast === 'function')
            gToast(label + ' ' + amt + ' ကျပ် — အတည်ပြုပြီး ✅', 'success');
        } else if (tx.status === 'rejected') {
          if (typeof gToast === 'function')
            gToast(label + ' ' + amt + ' ကျပ် — ငြင်းပယ်ပြီး ❌', 'error');
        }

        // Refresh tx history if the history tab inside withdraw modal is active
        var txList = document.getElementById('txList');
        if (txList) {
          var parent = txList.closest('.wd-content');
          if (parent && parent.classList.contains('active')) {
            if (typeof loadTxHistory === 'function') loadTxHistory();
          }
        }
      }
    )
    .subscribe(function(status, err) {
      if (err) console.error('[RT] transaction channel:', err);
    });
}

// ── Agent dashboard stats live updates ───────────────────────
function _subscribeAgentStats(userId) {
  if (!window.DB || !userId) return;
  if (_agentSub) { window.DB.removeChannel(_agentSub); _agentSub = null; }

  _agentSub = window.DB
    .channel('agent-stats-' + userId)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'agent_dashboard_stats', filter: 'agent_id=eq.' + userId },
      function() {
        if (typeof loadDashboardStats === 'function') loadDashboardStats(userId);
      }
    )
    .subscribe(function(status, err) {
      if (err) console.error('[RT] agent stats channel:', err);
    });
}

// ── Master setup — call after every successful login/restore ─
function setupUserRealtime(userId) {
  if (!window.DB || !userId) return;
  subscribeVipRealtime(userId);
  _subscribeTransactions(userId);
  _subscribeAgentStats(userId);
}

// ── Master teardown — call on logout ─────────────────────────
function teardownUserRealtime() {
  [_balanceSub, _txSub, _agentSub].forEach(function(ch) {
    if (ch && window.DB) { try { window.DB.removeChannel(ch); } catch(e) {} }
  });
  _balanceSub = null;
  _txSub      = null;
  _agentSub   = null;
}
