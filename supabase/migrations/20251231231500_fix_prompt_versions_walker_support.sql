-- ============================================================================
-- Rolloy Creative OS - Fix prompt_versions Walker Support
-- ============================================================================
-- Date: 2025-12-31
-- Description: Update prompt_versions table to support Walker product states
--              (IN_USE, STORED) in addition to Rollator states (FOLDED, UNFOLDED)
-- Issue: Walker sessions cannot create prompt versions because the CHECK
--        constraint only allows 'FOLDED' and 'UNFOLDED' states.
-- ============================================================================

-- Step 1: Drop the old restrictive constraint
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the constraint name dynamically (could be different in different envs)
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'prompt_versions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%product_state%';

    -- Drop if exists
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE prompt_versions DROP CONSTRAINT ' || constraint_name;
        RAISE NOTICE 'Dropped old constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'No existing product_state constraint found';
    END IF;
END $$;

-- Step 2: Add new constraint supporting all product types
ALTER TABLE prompt_versions
ADD CONSTRAINT check_prompt_version_product_state
CHECK (product_state IN ('FOLDED', 'UNFOLDED', 'IN_USE', 'STORED'));

-- Step 3: Add comment for documentation
COMMENT ON CONSTRAINT check_prompt_version_product_state ON prompt_versions IS
'Product states: FOLDED/UNFOLDED for rollator, IN_USE/STORED for walker';

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
    constraint_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO constraint_count
    FROM pg_constraint
    WHERE conrelid = 'prompt_versions'::regclass
      AND contype = 'c'
      AND conname = 'check_prompt_version_product_state';

    IF constraint_count = 1 THEN
        RAISE NOTICE 'SUCCESS: Constraint check_prompt_version_product_state created successfully';
    ELSE
        RAISE WARNING 'WARNING: Constraint not found! Migration may have failed.';
    END IF;
END $$;

-- ============================================================================
-- Done!
-- ============================================================================
