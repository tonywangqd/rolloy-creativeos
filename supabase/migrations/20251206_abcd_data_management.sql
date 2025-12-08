-- ABCD Data Management System - Database Migration
-- Created: 2025-12-06
-- Version: 1.0

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

    CONSTRAINT check_code_format CHECK (code ~ '^[A-Z0-9-]+$'),
    CONSTRAINT check_name_length CHECK (char_length(name_zh) > 0 AND char_length(name_zh) <= 255),
    CONSTRAINT check_prompt_length CHECK (char_length(ai_visual_prompt) > 0)
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

    CONSTRAINT check_code_format CHECK (code ~ '^[A-Z0-9-]+$'),
    CONSTRAINT check_name_length CHECK (char_length(name_zh) > 0 AND char_length(name_zh) <= 255),
    CONSTRAINT check_prompt_length CHECK (char_length(ai_visual_prompt) > 0)
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

    CONSTRAINT check_code_format CHECK (code ~ '^[A-Z0-9-]+$'),
    CONSTRAINT check_name_length CHECK (char_length(name_zh) > 0 AND char_length(name_zh) <= 255),
    CONSTRAINT check_prompt_length CHECK (char_length(ai_visual_prompt) > 0)
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

    CONSTRAINT check_code_format CHECK (code ~ '^[A-Z0-9-]+$'),
    CONSTRAINT check_name_length CHECK (char_length(name_zh) > 0 AND char_length(name_zh) <= 255),
    CONSTRAINT check_prompt_length CHECK (char_length(ai_visual_prompt) > 0)
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

    CONSTRAINT check_code_format CHECK (code ~ '^[A-Z0-9-]+$'),
    CONSTRAINT check_name_length CHECK (char_length(name_zh) > 0 AND char_length(name_zh) <= 255),
    CONSTRAINT check_prompt_length CHECK (char_length(ai_visual_prompt) > 0)
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

-- A-Scene Category Indexes
CREATE INDEX idx_a_scene_category_code ON a_scene_category(code);
CREATE INDEX idx_a_scene_category_active ON a_scene_category(is_active);
CREATE INDEX idx_a_scene_category_sort ON a_scene_category(sort_order);

-- A-Scene Detail Indexes
CREATE INDEX idx_a_scene_detail_code ON a_scene_detail(code);
CREATE INDEX idx_a_scene_detail_category_id ON a_scene_detail(category_id);
CREATE INDEX idx_a_scene_detail_active ON a_scene_detail(is_active);
CREATE INDEX idx_a_scene_detail_sort ON a_scene_detail(sort_order);

-- B-Action Indexes
CREATE INDEX idx_b_action_code ON b_action(code);
CREATE INDEX idx_b_action_active ON b_action(is_active);
CREATE INDEX idx_b_action_sort ON b_action(sort_order);

-- C-Emotion Indexes
CREATE INDEX idx_c_emotion_code ON c_emotion(code);
CREATE INDEX idx_c_emotion_active ON c_emotion(is_active);
CREATE INDEX idx_c_emotion_sort ON c_emotion(sort_order);

-- D-Format Indexes
CREATE INDEX idx_d_format_code ON d_format(code);
CREATE INDEX idx_d_format_active ON d_format(is_active);
CREATE INDEX idx_d_format_sort ON d_format(sort_order);

-- Full-text search indexes (optional, for future enhancement)
CREATE INDEX idx_a_scene_category_prompt_trgm ON a_scene_category USING GIN (ai_visual_prompt gin_trgm_ops);
CREATE INDEX idx_a_scene_detail_prompt_trgm ON a_scene_detail USING GIN (ai_visual_prompt gin_trgm_ops);
CREATE INDEX idx_b_action_prompt_trgm ON b_action USING GIN (ai_visual_prompt gin_trgm_ops);
CREATE INDEX idx_c_emotion_prompt_trgm ON c_emotion USING GIN (ai_visual_prompt gin_trgm_ops);
CREATE INDEX idx_d_format_prompt_trgm ON d_format USING GIN (ai_visual_prompt gin_trgm_ops);

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

CREATE TRIGGER update_a_scene_category_updated_at BEFORE UPDATE ON a_scene_category
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_a_scene_detail_updated_at BEFORE UPDATE ON a_scene_detail
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_b_action_updated_at BEFORE UPDATE ON b_action
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_c_emotion_updated_at BEFORE UPDATE ON c_emotion
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

-- Note: Cannot create index on view directly in PostgreSQL
-- The underlying tables already have indexes on code columns

-- ============================================================================
-- 5. RLS (Row Level Security) - Current: Public Access
-- ============================================================================

ALTER TABLE a_scene_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE a_scene_detail ENABLE ROW LEVEL SECURITY;
ALTER TABLE b_action ENABLE ROW LEVEL SECURITY;
ALTER TABLE c_emotion ENABLE ROW LEVEL SECURITY;
ALTER TABLE d_format ENABLE ROW LEVEL SECURITY;

-- A-Scene Category Policies
CREATE POLICY "Public can view scene_category" ON a_scene_category FOR SELECT USING (true);
CREATE POLICY "Public can create scene_category" ON a_scene_category FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update scene_category" ON a_scene_category FOR UPDATE USING (true);
CREATE POLICY "Public can delete scene_category" ON a_scene_category FOR DELETE USING (true);

-- A-Scene Detail Policies
CREATE POLICY "Public can view scene_detail" ON a_scene_detail FOR SELECT USING (true);
CREATE POLICY "Public can create scene_detail" ON a_scene_detail FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update scene_detail" ON a_scene_detail FOR UPDATE USING (true);
CREATE POLICY "Public can delete scene_detail" ON a_scene_detail FOR DELETE USING (true);

-- B-Action Policies
CREATE POLICY "Public can view b_action" ON b_action FOR SELECT USING (true);
CREATE POLICY "Public can create b_action" ON b_action FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update b_action" ON b_action FOR UPDATE USING (true);
CREATE POLICY "Public can delete b_action" ON b_action FOR DELETE USING (true);

-- C-Emotion Policies
CREATE POLICY "Public can view c_emotion" ON c_emotion FOR SELECT USING (true);
CREATE POLICY "Public can create c_emotion" ON c_emotion FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update c_emotion" ON c_emotion FOR UPDATE USING (true);
CREATE POLICY "Public can delete c_emotion" ON c_emotion FOR DELETE USING (true);

-- D-Format Policies
CREATE POLICY "Public can view d_format" ON d_format FOR SELECT USING (true);
CREATE POLICY "Public can create d_format" ON d_format FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update d_format" ON d_format FOR UPDATE USING (true);
CREATE POLICY "Public can delete d_format" ON d_format FOR DELETE USING (true);

-- ============================================================================
-- 6. SAMPLE DATA (Optional - For Testing)
-- ============================================================================

-- Sample A-Scene Categories
INSERT INTO a_scene_category (code, name_zh, ai_visual_prompt, sort_order) VALUES
('01-Home', '居家及养老院', '温暖的室内环境，体现居家安全感和养老场景的特点。家具舒适，照明柔和，装饰温馨。', 1),
('02-Office', '办公室', '现代化的办公环境，专业的氛围，工作台整洁，光线充足。', 2),
('03-Outdoor', '户外场景', '开放的户外环境，自然光线，绿化或景观元素，体现活动自由感。', 3),
('04-Healthcare', '医疗设施', '医疗专业环境，卫生安全，医疗设备，专业人员。', 4)
ON CONFLICT (code) DO NOTHING;

-- Sample A-Scene Details (matching category 01-Home)
INSERT INTO a_scene_detail (code, name_zh, category_id, ai_visual_prompt, sort_order) VALUES
('01-Bedroom', '普通居家-卧室', (SELECT id FROM a_scene_category WHERE code = '01-Home'), '温馨的卧室，柔和的灯光，舒适的床铺，简约的家具。', 1),
('02-Kitchen', '普通居家-厨房', (SELECT id FROM a_scene_category WHERE code = '01-Home'), '现代化的厨房，食材整洁摆放，烹饪设备完备。', 2)
ON CONFLICT (code) DO NOTHING;

-- Sample B-Actions
INSERT INTO b_action (code, name_zh, ai_visual_prompt, sort_order) VALUES
('01-Walk', '行走模式', '人物处于行走状态，步伐稳健，体现活力和自信。', 1),
('02-Sit', '坐姿', '人物坐在椅子或沙发上，姿态放松，舒适自然。', 2)
ON CONFLICT (code) DO NOTHING;

-- Sample C-Emotions
INSERT INTO c_emotion (code, name_zh, ai_visual_prompt, sort_order) VALUES
('01-Independence', '渴望独立', '表现独立自主的精神面貌，自信从容，体现个人能力。', 1),
('02-Joy', '快乐', '开朗积极的表情和姿态，体现幸福感和满足感。', 2)
ON CONFLICT (code) DO NOTHING;

-- Sample D-Formats
INSERT INTO d_format (code, name_zh, ai_visual_prompt, sort_order) VALUES
('I01-Lifestyle', '图片-生活场景', '生活化的拍摄风格，自然真实，强调日常感。', 1),
('I02-Product', '图片-产品展示', '产品为中心的拍摄，清晰展示，专业构图。', 2)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 7. VERIFICATION QUERIES
-- ============================================================================

-- Verify all tables created
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('a_scene_category', 'a_scene_detail', 'b_action', 'c_emotion', 'd_format');

-- Verify all indexes created
-- SELECT indexname FROM pg_indexes
-- WHERE tablename IN ('a_scene_category', 'a_scene_detail', 'b_action', 'c_emotion', 'd_format')
-- ORDER BY indexname;

-- Verify view created
-- SELECT viewname FROM pg_views WHERE schemaname = 'public' AND viewname LIKE 'v_abcd%';

-- ============================================================================
-- End of Migration
-- ============================================================================
