-- Rolloy Creative OS - Unify Walker Product States
-- Date: 2026-01-01
-- Description: Update Walker to use FOLDED/UNFOLDED states (same as Rollator)
--              Previously Walker used IN_USE/STORED, now unified for consistency
-- 
-- This migration:
-- 1. Migrates existing Walker data from IN_USE/STORED to UNFOLDED/FOLDED
-- 2. Updates the CHECK constraint on generation_sessions
-- 3. Updates the CHECK constraint on prompt_versions

-- ============================================================================
-- Step 1: Migrate existing Walker session data
-- ============================================================================

-- Update Walker sessions: IN_USE -> UNFOLDED
UPDATE generation_sessions 
SET product_state = 'UNFOLDED' 
WHERE product_type = 'walker' AND product_state = 'IN_USE';

-- Update Walker sessions: STORED -> FOLDED
UPDATE generation_sessions 
SET product_state = 'FOLDED' 
WHERE product_type = 'walker' AND product_state = 'STORED';

-- ============================================================================
-- Step 2: Migrate existing prompt_versions data
-- ============================================================================

-- Update prompt_versions: IN_USE -> UNFOLDED
UPDATE prompt_versions 
SET product_state = 'UNFOLDED' 
WHERE product_state = 'IN_USE';

-- Update prompt_versions: STORED -> FOLDED
UPDATE prompt_versions 
SET product_state = 'FOLDED' 
WHERE product_state = 'STORED';

-- ============================================================================
-- Step 3: Update CHECK constraint on generation_sessions
-- ============================================================================

-- Drop old constraint if exists
ALTER TABLE generation_sessions
DROP CONSTRAINT IF EXISTS check_product_state_by_type;

-- Add new unified constraint - both products use FOLDED/UNFOLDED
ALTER TABLE generation_sessions
ADD CONSTRAINT check_product_state_by_type
CHECK (
    product_state IN ('FOLDED', 'UNFOLDED')
);

-- ============================================================================
-- Step 4: Update CHECK constraint on prompt_versions
-- ============================================================================

-- Drop old constraint if exists
ALTER TABLE prompt_versions
DROP CONSTRAINT IF EXISTS check_prompt_version_product_state;

-- Add new unified constraint - only FOLDED/UNFOLDED allowed
ALTER TABLE prompt_versions
ADD CONSTRAINT check_prompt_version_product_state
CHECK (product_state IN ('FOLDED', 'UNFOLDED'));

-- ============================================================================
-- Step 5: Update comments for documentation
-- ============================================================================

COMMENT ON CONSTRAINT check_product_state_by_type ON generation_sessions IS
'Product states: Both rollator and walker use FOLDED/UNFOLDED';

COMMENT ON CONSTRAINT check_prompt_version_product_state ON prompt_versions IS
'Product states: Both rollator and walker use FOLDED/UNFOLDED';

-- ============================================================================
-- Verification queries (run manually to verify migration)
-- ============================================================================
-- SELECT product_type, product_state, COUNT(*) 
-- FROM generation_sessions 
-- GROUP BY product_type, product_state;

-- SELECT product_state, COUNT(*) 
-- FROM prompt_versions 
-- GROUP BY product_state;

