-- Rolloy Creative OS - Prompt Version Management Migration
-- Date: 2025-12-10
-- Description: Add prompt versioning system to track prompt refinements

-- ============================================================================
-- 1. Create prompt_versions Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS prompt_versions (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Key to Sessions
  session_id UUID NOT NULL REFERENCES generation_sessions(id) ON DELETE CASCADE,

  -- Version Info
  version_number INTEGER NOT NULL,  -- Sequential: 1, 2, 3, ...

  -- Prompt Content
  prompt TEXT NOT NULL,
  prompt_chinese TEXT,  -- Chinese translation (optional)

  -- Generation Parameters (snapshot at this version)
  product_state VARCHAR(20) NOT NULL CHECK (product_state IN ('FOLDED', 'UNFOLDED')),
  reference_image_url TEXT,

  -- Metadata
  created_from VARCHAR(50) DEFAULT 'manual' CHECK (
    created_from IN ('initial', 'refinement', 'product_state_change')
  ),
  refinement_instruction TEXT,  -- User's refinement instruction (if applicable)

  -- Status
  is_active BOOLEAN DEFAULT false,  -- Only one version can be active per session

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  UNIQUE(session_id, version_number)
);

-- ============================================================================
-- 2. Create Indexes
-- ============================================================================

-- Index for session lookups
CREATE INDEX IF NOT EXISTS idx_prompt_versions_session_id
  ON prompt_versions(session_id);

-- Index for active version lookups (partial index for performance)
CREATE INDEX IF NOT EXISTS idx_prompt_versions_session_active
  ON prompt_versions(session_id, is_active)
  WHERE is_active = true;

-- ============================================================================
-- 3. Row Level Security (RLS)
-- ============================================================================

ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;

-- Public access policy (consistent with existing tables)
CREATE POLICY "Allow public access to prompt_versions"
  ON prompt_versions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 4. Alter generated_images_v2 Table
-- ============================================================================

-- Add foreign key to prompt_versions
ALTER TABLE generated_images_v2
ADD COLUMN IF NOT EXISTS prompt_version_id UUID REFERENCES prompt_versions(id) ON DELETE SET NULL;

-- Create index for filtering images by version
CREATE INDEX IF NOT EXISTS idx_generated_images_v2_prompt_version
  ON generated_images_v2(prompt_version_id);

-- ============================================================================
-- 5. Backfill Existing Sessions
-- ============================================================================

-- Create V1 for all existing sessions that don't have versions yet
INSERT INTO prompt_versions (
  session_id,
  version_number,
  prompt,
  product_state,
  reference_image_url,
  created_from,
  is_active,
  created_at
)
SELECT
  gs.id as session_id,
  1 as version_number,
  gs.prompt,
  gs.product_state,
  gs.reference_image_url,
  'initial' as created_from,
  true as is_active,
  gs.created_at  -- Use session creation time as version creation time
FROM generation_sessions gs
WHERE NOT EXISTS (
  SELECT 1
  FROM prompt_versions pv
  WHERE pv.session_id = gs.id
);

-- ============================================================================
-- 6. Update Existing Images to Link to V1
-- ============================================================================

-- Link all existing images to their session's V1 version
UPDATE generated_images_v2 img
SET prompt_version_id = (
  SELECT pv.id
  FROM prompt_versions pv
  WHERE pv.session_id = img.session_id
    AND pv.version_number = 1
  LIMIT 1
)
WHERE img.prompt_version_id IS NULL;

-- ============================================================================
-- 7. Create View for Version Summary with Image Counts
-- ============================================================================

CREATE OR REPLACE VIEW v_prompt_version_summary AS
SELECT
  pv.id,
  pv.session_id,
  pv.version_number,
  pv.prompt,
  pv.prompt_chinese,
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
-- 8. Create Trigger to Ensure Single Active Version
-- ============================================================================

-- Function to ensure only one active version per session
CREATE OR REPLACE FUNCTION ensure_single_active_version()
RETURNS TRIGGER AS $$
BEGIN
  -- If new version is being set to active
  IF NEW.is_active = true THEN
    -- Deactivate all other versions in the same session
    UPDATE prompt_versions
    SET is_active = false
    WHERE session_id = NEW.session_id
      AND id != NEW.id
      AND is_active = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_ensure_single_active_version ON prompt_versions;
CREATE TRIGGER trigger_ensure_single_active_version
  BEFORE INSERT OR UPDATE OF is_active ON prompt_versions
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION ensure_single_active_version();

-- ============================================================================
-- 9. Validation Checks
-- ============================================================================

-- Verify that all sessions have at least one version
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM generation_sessions gs
  WHERE NOT EXISTS (
    SELECT 1 FROM prompt_versions pv WHERE pv.session_id = gs.id
  );

  IF orphan_count > 0 THEN
    RAISE WARNING 'Found % sessions without versions. Re-run backfill step.', orphan_count;
  ELSE
    RAISE NOTICE 'All sessions have versions. Migration successful!';
  END IF;
END $$;

-- Verify that each session has exactly one active version
DO $$
DECLARE
  multi_active_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO multi_active_count
  FROM (
    SELECT session_id
    FROM prompt_versions
    WHERE is_active = true
    GROUP BY session_id
    HAVING COUNT(*) > 1
  ) AS multi_active_sessions;

  IF multi_active_count > 0 THEN
    RAISE WARNING 'Found % sessions with multiple active versions. Check data integrity.', multi_active_count;
  ELSE
    RAISE NOTICE 'Each session has exactly one active version. Data integrity verified!';
  END IF;
END $$;

-- ============================================================================
-- Done!
-- ============================================================================

COMMENT ON TABLE prompt_versions IS 'Stores version history of prompts for each generation session';
COMMENT ON COLUMN prompt_versions.version_number IS 'Sequential version number within a session (1, 2, 3, ...)';
COMMENT ON COLUMN prompt_versions.is_active IS 'Indicates the currently active version for the session (only one can be true)';
COMMENT ON COLUMN prompt_versions.created_from IS 'Source of version creation: initial, refinement, or product_state_change';
COMMENT ON COLUMN prompt_versions.refinement_instruction IS 'User instruction used to refine the prompt (if created via refinement)';
