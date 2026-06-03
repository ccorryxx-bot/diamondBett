-- Migration: Add play_count tracking for Hot Games tab
-- Run this in Supabase SQL Editor (Database > SQL Editor)

-- 1. Add play_count column to game_cards (safe — skips if already exists)
ALTER TABLE game_cards
  ADD COLUMN IF NOT EXISTS play_count BIGINT DEFAULT 0;

-- 2. Index for fast top-7 query (ORDER BY play_count DESC LIMIT 7)
CREATE INDEX IF NOT EXISTS idx_game_cards_play_count
  ON game_cards (play_count DESC);

-- 3. Atomic increment function (avoids race conditions on concurrent clicks)
CREATE OR REPLACE FUNCTION increment_game_play(p_game_code TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE game_cards
  SET play_count = play_count + 1
  WHERE game_code = p_game_code;
END;
$$;

-- 4. Allow anon (frontend) and authenticated users to call the function
GRANT EXECUTE ON FUNCTION increment_game_play(TEXT) TO anon, authenticated;
