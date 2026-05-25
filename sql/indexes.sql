-- ============================================================
-- Diamond-BETT — Performance Indexes
-- Run this in Supabase SQL Editor (one-time setup)
-- ============================================================

-- 1. games table: speed up category filtering + date ordering
--    Used by: js/games.js → loadGamesFromDB()
CREATE INDEX IF NOT EXISTS idx_games_category_created
  ON games (category, created_at DESC);

-- 2. transactions table: speed up per-user history queries
--    Used by: js/withdraw.js → loadTxHistory()
CREATE INDEX IF NOT EXISTS idx_transactions_user_created
  ON transactions (user_id, created_at DESC);

-- 3. lucky_wheel_history: speed up "did user spin today?" check
--    Used by: js/auth.js → onLoginSuccess() spin check
CREATE INDEX IF NOT EXISTS idx_wheel_user_spun
  ON lucky_wheel_history (user_id, spun_at DESC);

-- 4. users table: speed up commission/referral queries (agent system)
CREATE INDEX IF NOT EXISTS idx_users_ref_code
  ON users (ref_code);

-- 5. commissions table: speed up agent dashboard stats
CREATE INDEX IF NOT EXISTS idx_commissions_agent_created
  ON commissions (agent_id, created_at DESC);

-- Verify indexes were created
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
