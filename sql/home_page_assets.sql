-- ============================================================
-- HOME PAGE ASSETS — Social Icons + License Logos
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS home_page_assets (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  type        TEXT         NOT NULL CHECK (type IN ('icon', 'license')),
  name        TEXT         NOT NULL,
  image_url   TEXT         NOT NULL,
  link_url    TEXT,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- RLS
ALTER TABLE home_page_assets ENABLE ROW LEVEL SECURITY;

-- Any visitor can read active assets (no auth needed)
CREATE POLICY "home_assets_public_read"
  ON home_page_assets FOR SELECT
  USING (is_active = true);

-- Admins (service_role) can do anything
CREATE POLICY "home_assets_admin_all"
  ON home_page_assets FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Allow authenticated admin users to manage
CREATE POLICY "home_assets_auth_admin"
  ON home_page_assets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.is_admin = true
    )
  );

-- Index
CREATE INDEX IF NOT EXISTS idx_home_assets_type_sort
  ON home_page_assets (type, sort_order ASC);

-- ── Example seed (replace with real ImageKit.io URLs) ────────
-- INSERT INTO home_page_assets (type, name, image_url, link_url, sort_order) VALUES
-- ('icon', 'Twitter',   'https://ik.imagekit.io/YOUR_ID/twitter.png',   'https://twitter.com',   1),
-- ('icon', 'TikTok',    'https://ik.imagekit.io/YOUR_ID/tiktok.png',    'https://tiktok.com',    2),
-- ('icon', 'Facebook',  'https://ik.imagekit.io/YOUR_ID/facebook.png',  'https://facebook.com',  3),
-- ('icon', 'Instagram', 'https://ik.imagekit.io/YOUR_ID/instagram.png', 'https://instagram.com', 4),
-- ('icon', 'YouTube',   'https://ik.imagekit.io/YOUR_ID/youtube.png',   'https://youtube.com',   5),
-- ('icon', 'Viber',     'https://ik.imagekit.io/YOUR_ID/viber.png',     null,                    6),
-- ('icon', '18+',       'https://ik.imagekit.io/YOUR_ID/18plus.png',    null,                    7),
-- ('license', 'PG Soft',            'https://ik.imagekit.io/YOUR_ID/pg.png',      null, 1),
-- ('license', 'TaDa Gaming',        'https://ik.imagekit.io/YOUR_ID/tada.png',    null, 2),
-- ('license', 'JDB',                'https://ik.imagekit.io/YOUR_ID/jdb.png',     null, 3),
-- ('license', 'PLAY',               'https://ik.imagekit.io/YOUR_ID/play.png',    null, 4),
-- ('license', 'MGA',                'https://ik.imagekit.io/YOUR_ID/mga1.png',    null, 5),
-- ('license', 'Gambling Commission','https://ik.imagekit.io/YOUR_ID/ukgc.png',    null, 6),
-- ('license', 'PAGCOR',             'https://ik.imagekit.io/YOUR_ID/pagcor.png',  null, 7),
-- ('license', 'Malta Gaming',       'https://ik.imagekit.io/YOUR_ID/malta.png',   null, 8),
-- ('license', 'Provider9',          'https://ik.imagekit.io/YOUR_ID/prov9.png',   null, 9);
