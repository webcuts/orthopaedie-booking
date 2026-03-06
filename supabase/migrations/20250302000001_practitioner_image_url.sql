-- ORTHO-042: Add image_url column to practitioners for doctor selection with photos
ALTER TABLE practitioners ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Set initial image URLs for current practitioners
UPDATE practitioners SET image_url = 'https://framerusercontent.com/images/VtSGYP4GLBsQk2YuUIJvSFAQc.jpg?scale-down-to=2048&width=1536&height=2555'
WHERE last_name = 'Jonda';

UPDATE practitioners SET image_url = 'https://framerusercontent.com/images/MNHKaDoncJGNirDUlYdFMcKQiXY.png?scale-down-to=1024&width=1306&height=1146'
WHERE last_name = 'Ercan';

UPDATE practitioners SET image_url = 'https://framerusercontent.com/images/oKSKUDxb0iVOUfy443v2tebJLyU.jpg?scale-down-to=2048&width=1398&height=2531'
WHERE last_name = 'Flores';
