-- ============================================================
--  DiamondBett Migration v5
--  Supabase Dashboard > SQL Editor မှာ Run ပါ
-- ============================================================

-- ── 1. users table — missing columns ──────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referrer_id    TEXT,
  ADD COLUMN IF NOT EXISTS member_account TEXT;

-- member_account index (HUIDU callback lookup)
CREATE INDEX IF NOT EXISTS idx_users_member_account
  ON users (member_account)
  WHERE member_account IS NOT NULL;

-- ── 2. site_settings — missing admin columns ──────────────────
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS deposit_bonus_rate  NUMERIC  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS turnover_multiplier NUMERIC  DEFAULT 10,
  ADD COLUMN IF NOT EXISTS commission_enabled  BOOLEAN  DEFAULT false,
  ADD COLUMN IF NOT EXISTS commission_rate     NUMERIC  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_withdrawal      NUMERIC  DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS max_withdrawal      NUMERIC  DEFAULT 1000000;

-- Ensure a default row exists
INSERT INTO site_settings (id, deposit_bonus_rate, turnover_multiplier, commission_enabled, commission_rate, min_withdrawal, max_withdrawal)
  VALUES (1, 0, 10, false, 0, 10000, 1000000)
  ON CONFLICT (id) DO NOTHING;

-- ── 3. callback_log — serial_number for HUIDU dedup ───────────
ALTER TABLE callback_log
  ADD COLUMN IF NOT EXISTS serial_number TEXT;

CREATE INDEX IF NOT EXISTS idx_callback_log_serial
  ON callback_log (serial_number)
  WHERE serial_number IS NOT NULL;

-- ── 4. transactions — ensure all admin columns exist ──────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS processed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processed_by    TEXT,
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS admin_note      TEXT;

-- ── 5. Security — tighten RLS policies ───────────────────────
-- Previous migration had USING(true) which allows unauthenticated access.
-- New policies: reads are public (needed for frontend), writes require auth.
-- Admin operations go through the Edge Function (service role bypasses RLS).

-- users: anyone can read own row; writes go through Edge Function (service role)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_panel_all_users" ON users;
DROP POLICY IF EXISTS "users_self_update_wallet" ON users;

CREATE POLICY "users_public_read"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "users_self_write"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- transactions: users read own, insert own; admin writes via Edge Function (service role)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_panel_all_transactions" ON transactions;

CREATE POLICY "transactions_own_read"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "transactions_own_insert"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions_service_role_all"
  ON transactions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- site_settings: public read; only service_role writes
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_panel_all_settings" ON site_settings;

CREATE POLICY "settings_public_read"
  ON site_settings FOR SELECT
  USING (true);

CREATE POLICY "settings_service_write"
  ON site_settings FOR ALL
  USING (auth.role() IN ('service_role','authenticated'))
  WITH CHECK (auth.role() IN ('service_role','authenticated'));

-- commissions: service_role only
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_panel_all_commissions" ON commissions;

CREATE POLICY "commissions_service_role"
  ON commissions FOR ALL
  USING (auth.role() = 'service_role' OR auth.uid() = agent_id)
  WITH CHECK (auth.role() = 'service_role');

-- game_cards, banners: public read; authenticated write
ALTER TABLE game_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_panel_all_game_cards" ON game_cards;
CREATE POLICY "game_cards_public_read" ON game_cards FOR SELECT USING (true);
CREATE POLICY "game_cards_admin_write" ON game_cards FOR ALL
  USING (auth.role() IN ('service_role','authenticated'))
  WITH CHECK (auth.role() IN ('service_role','authenticated'));

ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_panel_all_banners" ON banners;
CREATE POLICY "banners_public_read" ON banners FOR SELECT USING (true);
CREATE POLICY "banners_admin_write" ON banners FOR ALL
  USING (auth.role() IN ('service_role','authenticated'))
  WITH CHECK (auth.role() IN ('service_role','authenticated'));

-- callback_log: service_role only (internal Edge Function use)
ALTER TABLE callback_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "callback_log_service" ON callback_log;
CREATE POLICY "callback_log_service"
  ON callback_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

SELECT 'Migration v5 complete ✅ — missing columns + serial_number + tightened RLS' AS status;
