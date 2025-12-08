-- Rolloy Creative OS - Add aspect_ratio and resolution columns to generated_images_v2
-- Run this in Supabase SQL Editor

-- Add aspect_ratio column (e.g., "1:1", "16:9", "9:16", "2:3", "3:2")
ALTER TABLE generated_images_v2
ADD COLUMN IF NOT EXISTS aspect_ratio VARCHAR(10) DEFAULT '1:1';

-- Add resolution column (e.g., "1K", "2K", "4K")
ALTER TABLE generated_images_v2
ADD COLUMN IF NOT EXISTS resolution VARCHAR(10) DEFAULT '1K';

-- Add comment for documentation
COMMENT ON COLUMN generated_images_v2.aspect_ratio IS 'Image aspect ratio, e.g., 1:1, 16:9, 9:16';
COMMENT ON COLUMN generated_images_v2.resolution IS 'Image resolution, e.g., 1K, 2K, 4K';

-- Done!
