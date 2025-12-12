-- Rolloy Creative OS - Add Video Prompt Column Migration
-- Date: 2025-12-12
-- Description: Add video_prompt column to prompt_versions table for AI video generation

-- ============================================================================
-- 1. Add video_prompt Column to prompt_versions Table
-- ============================================================================

ALTER TABLE prompt_versions
ADD COLUMN IF NOT EXISTS video_prompt TEXT;

COMMENT ON COLUMN prompt_versions.video_prompt IS 'AI-generated video prompt derived from image prompt, for video generation platforms like Sora, Runway, Kling';

-- ============================================================================
-- 2. Update View to Include video_prompt
-- ============================================================================

CREATE OR REPLACE VIEW v_prompt_version_summary AS
SELECT
  pv.id,
  pv.session_id,
  pv.version_number,
  pv.prompt,
  pv.prompt_chinese,
  pv.video_prompt,
  pv.product_state,
  pv.reference_image_url,
  pv.created_from,
  pv.refinement_instruction,
  pv.is_active,
  pv.created_at,
  -- Prompt preview (first 40 characters)
  CASE
    WHEN LENGTH(pv.prompt) > 40
    THEN SUBSTRING(pv.prompt, 1, 40) || '...'
    ELSE pv.prompt
  END as prompt_preview,
  -- Image counts
  COALESCE(img_stats.total_count, 0) as image_count,
  COALESCE(img_stats.success_count, 0) as success_image_count,
  COALESCE(img_stats.failed_count, 0) as failed_image_count,
  COALESCE(img_stats.avg_rating, 0) as avg_rating
FROM prompt_versions pv
LEFT JOIN (
  SELECT
    prompt_version_id,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE status = 'success') as success_count,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
    AVG(rating) FILTER (WHERE rating > 0) as avg_rating
  FROM generated_images_v2
  GROUP BY prompt_version_id
) img_stats ON pv.id = img_stats.prompt_version_id;

-- ============================================================================
-- Done!
-- ============================================================================

RAISE NOTICE 'Migration complete: video_prompt column added to prompt_versions table';
