-- ============================================================
--  Fix 001 — member_account column + unique index
--  Supabase Dashboard > SQL Editor မှာ Run ပါ
--  Issue: HUIDU callback full table scan → O(n) performance
--  Fix: member_account TEXT UNIQUE → O(1) index lookup
-- ============================================================

-- Step 1: Column ထည့်
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS member_account TEXT;

-- Step 2: ရှိပြီးသား users တွေကို backfill
-- (format: "hdf801_" + first 10 chars of UUID without dashes)
UPDATE users
SET member_account = 'hdf801_' || LEFT(REPLACE(id::text, '-', ''), 10)
WHERE member_account IS NULL;

-- Step 3: Unique index — callback query O(1) ဖြစ်သွားမယ်
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_member_account
  ON users (member_account);

-- Step 4: NOT NULL constraint (backfill ပြီးမှ ထည့်)
ALTER TABLE users
  ALTER COLUMN member_account SET NOT NULL;

-- ── Verify ────────────────────────────────────────────────
SELECT
  COUNT(*)                                          AS total_users,
  COUNT(member_account)                             AS with_member_account,
  COUNT(*) - COUNT(member_account)                  AS missing
FROM users;

SELECT 'Fix 001 — member_account index ✅' AS status;
