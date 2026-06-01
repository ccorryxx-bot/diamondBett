-- ============================================================
--  Fix 002 — wallet columns (withdrawal_method / account / name)
--  Supabase Dashboard > SQL Editor မှာ Run ပါ
--  Issue: Withdraw target stored only in localStorage → tamper risk
--  Fix: Store in users table → DB is source of truth
-- ============================================================

-- Step 1: Columns ထည့် (ရှိပြီးသား project တွေအတွက် IF NOT EXISTS)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS withdrawal_method  TEXT,
  ADD COLUMN IF NOT EXISTS withdrawal_account TEXT,
  ADD COLUMN IF NOT EXISTS withdrawal_name    TEXT;

-- Step 2: Index — admin panel user list မှာ account စစ်ရင် အသုံးဝင်
CREATE INDEX IF NOT EXISTS idx_users_withdrawal_account
  ON users (withdrawal_account)
  WHERE withdrawal_account IS NOT NULL;

-- Step 3: RLS — user မိမိ row ကိုသာ update လုပ်နိုင် (existing policy ကို extend)
-- (site_settings မဟုတ် — users table ပဲ)
-- Note: ရှိပြီးသား users RLS policy ရှိရင် ဒါ skip လုပ်နိုင်
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users'
      AND policyname = 'users_self_update_wallet'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "users_self_update_wallet"
        ON users FOR UPDATE
        USING (auth.uid() = id)
        WITH CHECK (auth.uid() = id)
    $pol$;
  END IF;
END
$$;

-- ── Verify ────────────────────────────────────────────────
SELECT
  COUNT(*)                                  AS total_users,
  COUNT(withdrawal_account)                 AS linked_wallets,
  COUNT(*) - COUNT(withdrawal_account)      AS not_linked_yet
FROM users;

SELECT 'Fix 002 — wallet columns in DB ✅' AS status;
