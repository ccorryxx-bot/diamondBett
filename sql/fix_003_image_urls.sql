-- Migration fix_003: Set image_url for all game_cards using jsDelivr CDN
-- URL pattern: cdn.jsdelivr.net/gh/ccorryxx-bot/game-assets@main/{provider_code}/{game_code}.jpg
-- Prerequisites:
--   1. Upload images to https://github.com/ccorryxx-bot/game-assets
--      Folder structure: pg/{uid}.jpg, pp/{uid}.jpg, jili/{uid}.jpg, jdb/{uid}.jpg
--   2. Then run this migration

UPDATE game_cards
SET image_url = 'https://cdn.jsdelivr.net/gh/ccorryxx-bot/game-assets@main/' || provider_code || '/' || game_code || '.jpg'
WHERE image_url = '' OR image_url IS NULL;

-- Verify result
SELECT provider_code,
       COUNT(*) AS total,
       COUNT(CASE WHEN image_url != '' THEN 1 END) AS with_image_url
FROM game_cards
GROUP BY provider_code
ORDER BY provider_code;
