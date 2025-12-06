-- Rolloy Creative OS - Session Tables Migration
-- Run this in Supabase SQL Editor

-- ============================================================================
-- 1. Generation Sessions Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS generation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_name VARCHAR(255) NOT NULL,
  description TEXT,
  abcd_selection JSONB NOT NULL,
  prompt TEXT NOT NULL,
  product_state VARCHAR(20) NOT NULL CHECK (product_state IN ('FOLDED', 'UNFOLDED')),
  reference_image_url TEXT,
  total_images INTEGER NOT NULL DEFAULT 20,
  generated_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  strength DECIMAL(3,2) DEFAULT 0.75,
  seed INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'paused', 'completed', 'cancelled', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- 2. Generated Images Table (v2)
-- ============================================================================

CREATE TABLE IF NOT EXISTS generated_images_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES generation_sessions(id) ON DELETE CASCADE,
  image_index INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'success', 'failed', 'cancelled')),
  storage_url TEXT,
  storage_path TEXT,
  mime_type VARCHAR(50) DEFAULT 'image/png',
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  provider VARCHAR(50) DEFAULT 'gemini',
  model VARCHAR(100),
  generation_time_ms INTEGER,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  rating INTEGER DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  generated_at TIMESTAMP WITH TIME ZONE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_generated_images_v2_session_id ON generated_images_v2(session_id);
CREATE INDEX IF NOT EXISTS idx_generated_images_v2_status ON generated_images_v2(status);

-- ============================================================================
-- 3. Session Summary View
-- ============================================================================

CREATE OR REPLACE VIEW v_session_summary AS
SELECT
  s.id,
  s.creative_name,
  s.description,
  s.abcd_selection,
  s.prompt,
  s.product_state,
  s.reference_image_url,
  s.total_images,
  s.strength,
  s.seed,
  s.status,
  s.created_at,
  s.updated_at,
  s.started_at,
  s.completed_at,
  COALESCE(img_stats.generated_count, 0) as generated_count,
  COALESCE(img_stats.failed_count, 0) as failed_count,
  COALESCE(img_stats.pending_count, 0) as pending_count,
  CASE
    WHEN s.total_images > 0
    THEN ROUND((COALESCE(img_stats.generated_count, 0)::DECIMAL / s.total_images) * 100, 1)
    ELSE 0
  END as progress_percentage
FROM generation_sessions s
LEFT JOIN (
  SELECT
    session_id,
    COUNT(*) FILTER (WHERE status = 'success') as generated_count,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count
  FROM generated_images_v2
  GROUP BY session_id
) img_stats ON s.id = img_stats.session_id;

-- ============================================================================
-- 4. Update Trigger for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_generation_sessions_updated_at ON generation_sessions;
CREATE TRIGGER update_generation_sessions_updated_at
  BEFORE UPDATE ON generation_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. Row Level Security (RLS)
-- ============================================================================

ALTER TABLE generation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_images_v2 ENABLE ROW LEVEL SECURITY;

-- Allow public access (since this app doesn't have user authentication)
CREATE POLICY "Allow public access to sessions" ON generation_sessions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public access to images" ON generated_images_v2
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- Done!
-- ============================================================================
