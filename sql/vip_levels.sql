-- ============================================================
-- VIP LEVELS TABLE
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS vip_levels (
  id          SERIAL PRIMARY KEY,
  level       INTEGER      UNIQUE NOT NULL,
  label       TEXT         NOT NULL,              -- "V1" … "V20"
  min_deposit NUMERIC(18,2) NOT NULL,             -- cumulative deposit required (MMK)
  rebate_pct  NUMERIC(6,3) NOT NULL DEFAULT 0,   -- rebate % — set by admin panel
  promo_amt   NUMERIC(18,2) NOT NULL DEFAULT 0,  -- promotional bonus amount — set by admin
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- Allow any logged-in user to read VIP levels
ALTER TABLE vip_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vip_levels_public_read"
  ON vip_levels FOR SELECT USING (true);

-- Only service_role (admin) may insert/update/delete
CREATE POLICY "vip_levels_admin_write"
  ON vip_levels FOR ALL
  USING    (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── Seed data (levels 1-20) ───────────────────────────────
-- rebate_pct and promo_amt start at 0 — configure via admin panel
INSERT INTO vip_levels (level, label, min_deposit, rebate_pct, promo_amt) VALUES
-- User-defined levels 1-6
(1,  'V1',         3000.00,  0, 0),
(2,  'V2',        10000.00,  0, 0),
(3,  'V3',        30000.00,  0, 0),
(4,  'V4',        60000.00,  0, 0),
(5,  'V5',        80000.00,  0, 0),
(6,  'V6',       100000.00,  0, 0),
-- Escalating levels 7-20
(7,  'V7',       200000.00,  0, 0),
(8,  'V8',       350000.00,  0, 0),
(9,  'V9',       500000.00,  0, 0),
(10, 'V10',      750000.00,  0, 0),
(11, 'V11',     1000000.00,  0, 0),
(12, 'V12',     1500000.00,  0, 0),
(13, 'V13',     2500000.00,  0, 0),
(14, 'V14',     4000000.00,  0, 0),
(15, 'V15',     6000000.00,  0, 0),
(16, 'V16',    10000000.00,  0, 0),
(17, 'V17',    15000000.00,  0, 0),
(18, 'V18',    25000000.00,  0, 0),
(19, 'V19',    40000000.00,  0, 0),
(20, 'V20',    60000000.00,  0, 0)
ON CONFLICT (level) DO NOTHING;
