-- ============================================================
--  Fix 006: Missing columns — transactions + users
--  Supabase Dashboard > SQL Editor မှာ Run ပါ
-- ============================================================

-- transactions: deposit slip bonus flag + order reference
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS bonus_opted BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS reference   TEXT;

-- users: last login timestamp
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Verify
SELECT 'Fix 006 complete ✅ — bonus_opted, reference, last_login_at added' AS status;
