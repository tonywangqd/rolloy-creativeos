-- Rolloy Creative OS - Add product_state to b_action table
-- This enables proper routing of actions to FOLDED/UNFOLDED states

-- Add product_state column
ALTER TABLE b_action
ADD COLUMN IF NOT EXISTS product_state VARCHAR(20) DEFAULT 'UNFOLDED'
CHECK (product_state IN ('FOLDED', 'UNFOLDED'));

-- Update existing actions based on their typical usage
-- FOLDED actions (storage, transport, compact state)
UPDATE b_action SET product_state = 'FOLDED' WHERE code IN (
  'lift', 'pack', 'carry', 'trunk', 'car_trunk', 'store', 'transport', 'fold',
  'beside', 'place', 'lean', 'hold', 'unbox', 'display_folded',
  '收纳', '搬运', '折叠', '放置', '提起'
);

-- UNFOLDED actions (in-use state)
UPDATE b_action SET product_state = 'UNFOLDED' WHERE code IN (
  'walk', 'sit', 'turn', 'stand', 'rest', 'using', 'stroll', 'push', 'roll',
  'display_open', '行走', '使用', '站立', '坐下', '散步'
);

-- Add comment for documentation
COMMENT ON COLUMN b_action.product_state IS 'Product state routing: FOLDED for compact/storage actions, UNFOLDED for in-use actions';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_b_action_product_state ON b_action(product_state);
