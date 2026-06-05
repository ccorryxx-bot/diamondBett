-- ============================================================
--  Fix 005: Set deposit_bonus_rate default to 20%
--  Run in Supabase Dashboard > SQL Editor
-- ============================================================

-- Ensure site_settings row exists first (from migration_v5)
INSERT INTO site_settings (id, deposit_bonus_rate, turnover_multiplier, commission_enabled, commission_rate, min_withdrawal, max_withdrawal)
  VALUES (1, 20, 10, false, 0, 10000, 1000000)
  ON CONFLICT (id) DO UPDATE
    SET deposit_bonus_rate = EXCLUDED.deposit_bonus_rate
    WHERE site_settings.deposit_bonus_rate = 0; -- only update if still at default 0

-- Force update to 20 regardless
UPDATE site_settings SET deposit_bonus_rate = 20 WHERE id = 1;

-- Verify
SELECT id, deposit_bonus_rate, turnover_multiplier, commission_enabled, commission_rate,
       min_withdrawal, max_withdrawal
FROM site_settings WHERE id = 1;
