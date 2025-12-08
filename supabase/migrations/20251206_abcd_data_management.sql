-- ABCD Data Management System - Database Migration
-- Created: 2025-12-06
-- Version: 1.1 (Fixed: code format, pg_trgm extension, removed sample data)

-- ============================================================================
-- 0. ENABLE REQUIRED EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- 1. CREATE TABLES
-- ============================================================================

-- A-Scene Category
CREATE TABLE IF NOT EXISTS a_scene_category (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name_zh VARCHAR(255) NOT NULL,
    ai_visual_prompt TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT a_scene_category_check_name_length CHECK (char_length(name_zh) > 0 AND char_length(name_zh) <= 255),
    CONSTRAINT a_scene_category_check_prompt_length CHECK (char_length(ai_visual_prompt) > 0)
);

-- A-Scene Detail
CREATE TABLE IF NOT EXISTS a_scene_detail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name_zh VARCHAR(255) NOT NULL,
    ai_visual_prompt TEXT NOT NULL,
    category_id UUID NOT NULL REFERENCES a_scene_category(id) ON DELETE RESTRICT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT a_scene_detail_check_name_length CHECK (char_length(name_zh) > 0 AND char_length(name_zh) <= 255),
    CONSTRAINT a_scene_detail_check_prompt_length CHECK (char_length(ai_visual_prompt) > 0)
);

-- B-Action
CREATE TABLE IF NOT EXISTS b_action (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name_zh VARCHAR(255) NOT NULL,
    ai_visual_prompt TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT b_action_check_name_length CHECK (char_length(name_zh) > 0 AND char_length(name_zh) <= 255),
    CONSTRAINT b_action_check_prompt_length CHECK (char_length(ai_visual_prompt) > 0)
);

-- C-Emotion
CREATE TABLE IF NOT EXISTS c_emotion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name_zh VARCHAR(255) NOT NULL,
    ai_visual_prompt TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT c_emotion_check_name_length CHECK (char_length(name_zh) > 0 AND char_length(name_zh) <= 255),
    CONSTRAINT c_emotion_check_prompt_length CHECK (char_length(ai_visual_prompt) > 0)
);

-- D-Format
CREATE TABLE IF NOT EXISTS d_format (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name_zh VARCHAR(255) NOT NULL,
    ai_visual_prompt TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT d_format_check_name_length CHECK (char_length(name_zh) > 0 AND char_length(name_zh) <= 255),
    CONSTRAINT d_format_check_prompt_length CHECK (char_length(ai_visual_prompt) > 0)
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

-- A-Scene Category Indexes
CREATE INDEX IF NOT EXISTS idx_a_scene_category_code ON a_scene_category(code);
CREATE INDEX IF NOT EXISTS idx_a_scene_category_active ON a_scene_category(is_active);
CREATE INDEX IF NOT EXISTS idx_a_scene_category_sort ON a_scene_category(sort_order);

-- A-Scene Detail Indexes
CREATE INDEX IF NOT EXISTS idx_a_scene_detail_code ON a_scene_detail(code);
CREATE INDEX IF NOT EXISTS idx_a_scene_detail_category_id ON a_scene_detail(category_id);
CREATE INDEX IF NOT EXISTS idx_a_scene_detail_active ON a_scene_detail(is_active);
CREATE INDEX IF NOT EXISTS idx_a_scene_detail_sort ON a_scene_detail(sort_order);

-- B-Action Indexes
CREATE INDEX IF NOT EXISTS idx_b_action_code ON b_action(code);
CREATE INDEX IF NOT EXISTS idx_b_action_active ON b_action(is_active);
CREATE INDEX IF NOT EXISTS idx_b_action_sort ON b_action(sort_order);

-- C-Emotion Indexes
CREATE INDEX IF NOT EXISTS idx_c_emotion_code ON c_emotion(code);
CREATE INDEX IF NOT EXISTS idx_c_emotion_active ON c_emotion(is_active);
CREATE INDEX IF NOT EXISTS idx_c_emotion_sort ON c_emotion(sort_order);

-- D-Format Indexes
CREATE INDEX IF NOT EXISTS idx_d_format_code ON d_format(code);
CREATE INDEX IF NOT EXISTS idx_d_format_active ON d_format(is_active);
CREATE INDEX IF NOT EXISTS idx_d_format_sort ON d_format(sort_order);

-- Full-text search indexes (requires pg_trgm extension)
CREATE INDEX IF NOT EXISTS idx_a_scene_category_prompt_trgm ON a_scene_category USING GIN (ai_visual_prompt gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_a_scene_detail_prompt_trgm ON a_scene_detail USING GIN (ai_visual_prompt gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_b_action_prompt_trgm ON b_action USING GIN (ai_visual_prompt gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_c_emotion_prompt_trgm ON c_emotion USING GIN (ai_visual_prompt gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_d_format_prompt_trgm ON d_format USING GIN (ai_visual_prompt gin_trgm_ops);

-- ============================================================================
-- 3. CREATE TRIGGERS (Auto-update updated_at)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_a_scene_category_updated_at ON a_scene_category;
CREATE TRIGGER update_a_scene_category_updated_at BEFORE UPDATE ON a_scene_category
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_a_scene_detail_updated_at ON a_scene_detail;
CREATE TRIGGER update_a_scene_detail_updated_at BEFORE UPDATE ON a_scene_detail
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_b_action_updated_at ON b_action;
CREATE TRIGGER update_b_action_updated_at BEFORE UPDATE ON b_action
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_c_emotion_updated_at ON c_emotion;
CREATE TRIGGER update_c_emotion_updated_at BEFORE UPDATE ON c_emotion
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_d_format_updated_at ON d_format;
CREATE TRIGGER update_d_format_updated_at BEFORE UPDATE ON d_format
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. CREATE VIEW (For Aggregated Query)
-- ============================================================================

CREATE OR REPLACE VIEW v_abcd_full_context AS
SELECT
    'scene_category' as dimension,
    id,
    code,
    name_zh,
    ai_visual_prompt,
    sort_order
FROM a_scene_category
WHERE is_active = true

UNION ALL

SELECT 'scene_detail', id, code, name_zh, ai_visual_prompt, sort_order
FROM a_scene_detail WHERE is_active = true

UNION ALL

SELECT 'action', id, code, name_zh, ai_visual_prompt, sort_order
FROM b_action WHERE is_active = true

UNION ALL

SELECT 'emotion', id, code, name_zh, ai_visual_prompt, sort_order
FROM c_emotion WHERE is_active = true

UNION ALL

SELECT 'format', id, code, name_zh, ai_visual_prompt, sort_order
FROM d_format WHERE is_active = true;

-- ============================================================================
-- 5. RLS (Row Level Security) - Current: Public Access
-- ============================================================================

ALTER TABLE a_scene_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE a_scene_detail ENABLE ROW LEVEL SECURITY;
ALTER TABLE b_action ENABLE ROW LEVEL SECURITY;
ALTER TABLE c_emotion ENABLE ROW LEVEL SECURITY;
ALTER TABLE d_format ENABLE ROW LEVEL SECURITY;

-- A-Scene Category Policies
DROP POLICY IF EXISTS "Public can view scene_category" ON a_scene_category;
DROP POLICY IF EXISTS "Public can create scene_category" ON a_scene_category;
DROP POLICY IF EXISTS "Public can update scene_category" ON a_scene_category;
DROP POLICY IF EXISTS "Public can delete scene_category" ON a_scene_category;
CREATE POLICY "Public can view scene_category" ON a_scene_category FOR SELECT USING (true);
CREATE POLICY "Public can create scene_category" ON a_scene_category FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update scene_category" ON a_scene_category FOR UPDATE USING (true);
CREATE POLICY "Public can delete scene_category" ON a_scene_category FOR DELETE USING (true);

-- A-Scene Detail Policies
DROP POLICY IF EXISTS "Public can view scene_detail" ON a_scene_detail;
DROP POLICY IF EXISTS "Public can create scene_detail" ON a_scene_detail;
DROP POLICY IF EXISTS "Public can update scene_detail" ON a_scene_detail;
DROP POLICY IF EXISTS "Public can delete scene_detail" ON a_scene_detail;
CREATE POLICY "Public can view scene_detail" ON a_scene_detail FOR SELECT USING (true);
CREATE POLICY "Public can create scene_detail" ON a_scene_detail FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update scene_detail" ON a_scene_detail FOR UPDATE USING (true);
CREATE POLICY "Public can delete scene_detail" ON a_scene_detail FOR DELETE USING (true);

-- B-Action Policies
DROP POLICY IF EXISTS "Public can view b_action" ON b_action;
DROP POLICY IF EXISTS "Public can create b_action" ON b_action;
DROP POLICY IF EXISTS "Public can update b_action" ON b_action;
DROP POLICY IF EXISTS "Public can delete b_action" ON b_action;
CREATE POLICY "Public can view b_action" ON b_action FOR SELECT USING (true);
CREATE POLICY "Public can create b_action" ON b_action FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update b_action" ON b_action FOR UPDATE USING (true);
CREATE POLICY "Public can delete b_action" ON b_action FOR DELETE USING (true);

-- C-Emotion Policies
DROP POLICY IF EXISTS "Public can view c_emotion" ON c_emotion;
DROP POLICY IF EXISTS "Public can create c_emotion" ON c_emotion;
DROP POLICY IF EXISTS "Public can update c_emotion" ON c_emotion;
DROP POLICY IF EXISTS "Public can delete c_emotion" ON c_emotion;
CREATE POLICY "Public can view c_emotion" ON c_emotion FOR SELECT USING (true);
CREATE POLICY "Public can create c_emotion" ON c_emotion FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update c_emotion" ON c_emotion FOR UPDATE USING (true);
CREATE POLICY "Public can delete c_emotion" ON c_emotion FOR DELETE USING (true);

-- D-Format Policies
DROP POLICY IF EXISTS "Public can view d_format" ON d_format;
DROP POLICY IF EXISTS "Public can create d_format" ON d_format;
DROP POLICY IF EXISTS "Public can update d_format" ON d_format;
DROP POLICY IF EXISTS "Public can delete d_format" ON d_format;
CREATE POLICY "Public can view d_format" ON d_format FOR SELECT USING (true);
CREATE POLICY "Public can create d_format" ON d_format FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update d_format" ON d_format FOR UPDATE USING (true);
CREATE POLICY "Public can delete d_format" ON d_format FOR DELETE USING (true);

-- ============================================================================
-- End of Migration
-- ============================================================================
