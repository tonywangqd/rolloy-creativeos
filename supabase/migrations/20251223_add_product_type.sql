-- Rolloy Creative OS - Add Product Type Column Migration
-- Date: 2025-12-23
-- Description: Add product_type column to support Walker product line
--              and update product_state constraint for Walker states

-- ============================================================================
-- 1. Add product_type Column
-- ============================================================================

ALTER TABLE generation_sessions
ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'rollator' NOT NULL;

-- Add comment
COMMENT ON COLUMN generation_sessions.product_type IS 'Product type: rollator (4-wheel) or walker (2-wheel)';

-- ============================================================================
-- 2. Drop Old Constraint and Add New One
-- ============================================================================

-- First, drop the existing CHECK constraint on product_state
-- The constraint was created without a name, so we need to find and drop it
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the constraint name
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'generation_sessions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%product_state%';

    -- Drop if exists
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE generation_sessions DROP CONSTRAINT ' || constraint_name;
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END IF;
END $$;

-- Add new CHECK constraint for product_type
ALTER TABLE generation_sessions
ADD CONSTRAINT check_product_type
CHECK (product_type IN ('rollator', 'walker'));

-- Add new CHECK constraint for product_state based on product_type
-- Rollator: FOLDED, UNFOLDED
-- Walker: IN_USE, STORED
ALTER TABLE generation_sessions
ADD CONSTRAINT check_product_state_by_type
CHECK (
    (product_type = 'rollator' AND product_state IN ('FOLDED', 'UNFOLDED'))
    OR
    (product_type = 'walker' AND product_state IN ('IN_USE', 'STORED'))
);

-- ============================================================================
-- 3. Add Index for Product Type Filtering
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sessions_product_type
ON generation_sessions(product_type, created_at DESC);

-- ============================================================================
-- 4. Update View to Include product_type
-- ============================================================================

CREATE OR REPLACE VIEW v_session_summary AS
SELECT
    s.id,
    s.creative_name,
    s.description,
    s.abcd_selection,
    s.prompt,
    s.product_type,
    s.product_state,
    s.reference_image_url,
    s.status,
    s.total_images,
    s.generated_count,
    s.failed_count,
    s.strength,
    s.seed,
    s.error_message,
    s.created_at,
    s.updated_at,
    s.started_at,
    s.completed_at,
    s.paused_at,
    -- Calculated fields
    CASE
        WHEN s.total_images > 0 THEN
            ROUND((s.generated_count::DECIMAL / s.total_images * 100), 2)
        ELSE 0
    END AS progress_percentage,
    -- Image counts by status
    (SELECT COUNT(*) FROM generated_images_v2 WHERE session_id = s.id AND status = 'pending') AS pending_count,
    (SELECT COUNT(*) FROM generated_images_v2 WHERE session_id = s.id AND status = 'generating') AS generating_count,
    (SELECT COUNT(*) FROM generated_images_v2 WHERE session_id = s.id AND status = 'success') AS success_count,
    (SELECT COUNT(*) FROM generated_images_v2 WHERE session_id = s.id AND status = 'failed') AS failed_count_actual,
    -- Latest image
    (SELECT storage_url FROM generated_images_v2 WHERE session_id = s.id AND status = 'success' ORDER BY image_index DESC LIMIT 1) AS latest_image_url,
    -- Duration
    CASE
        WHEN s.completed_at IS NOT NULL AND s.started_at IS NOT NULL THEN
            EXTRACT(EPOCH FROM (s.completed_at - s.started_at))::INTEGER
        WHEN s.started_at IS NOT NULL THEN
            EXTRACT(EPOCH FROM (NOW() - s.started_at))::INTEGER
        ELSE NULL
    END AS duration_seconds
FROM generation_sessions s;

-- ============================================================================
-- Done!
-- ============================================================================
