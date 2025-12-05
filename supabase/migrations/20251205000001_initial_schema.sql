-- ============================================================================
-- Rolloy Creative OS - Initial Database Schema
-- ============================================================================
-- Description: Complete database schema for DTC Ad Creative Production System
-- Version: 1.0
-- Date: 2025-12-05
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For full-text search

-- ============================================================================
-- ENUMS: Define all enumeration types
-- ============================================================================

-- Scene categories (first level)
CREATE TYPE scene_category AS ENUM (
    'indoor',
    'outdoor',
    'lifestyle',
    'product_focus'
);

-- Action types (determines product state)
CREATE TYPE action_type AS ENUM (
    'using',           -- Product in use (expanded state)
    'displaying',      -- Product display (folded state)
    'comparing',       -- Product comparison
    'unboxing',        -- Unboxing scene
    'testimonial'      -- User testimonial
);

-- Product state (driven by action)
CREATE TYPE product_state AS ENUM (
    'expanded',        -- Walker fully opened
    'folded',          -- Walker folded
    'both'             -- Both states shown
);

-- Driver emotions
CREATE TYPE driver_emotion AS ENUM (
    'confidence',
    'joy',
    'relief',
    'independence',
    'safety',
    'elegance'
);

-- Format compositions
CREATE TYPE format_code AS ENUM (
    'CU',    -- Close-up
    'MS',    -- Medium shot
    'FS',    -- Full shot
    'OTS',   -- Over the shoulder
    'POV'    -- Point of view
);

-- Generation status
CREATE TYPE generation_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled'
);

-- API provider
CREATE TYPE api_provider AS ENUM (
    'gemini',
    'nano_banana',
    'flux',
    'openai'
);

-- Performance tier
CREATE TYPE performance_tier AS ENUM (
    'top_10',
    'top_20',
    'top_50',
    'below_50'
);

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Users Table (extends Supabase Auth)
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
    api_quota_limit INTEGER DEFAULT 1000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Scenes Table (ABCD - A: Scene with two-level selection)
-- ----------------------------------------------------------------------------
CREATE TABLE scenes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category scene_category NOT NULL,
    name TEXT NOT NULL,                    -- e.g., "Living Room", "Park", "Beach"
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(category, name)
);

-- ----------------------------------------------------------------------------
-- Actions Table (ABCD - B: Action determines product state)
-- ----------------------------------------------------------------------------
CREATE TABLE actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,             -- e.g., "Using Walker", "Display Folded"
    action_type action_type NOT NULL,
    product_state product_state NOT NULL,  -- State routing logic
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Drivers Table (ABCD - C: Emotional Driver)
-- ----------------------------------------------------------------------------
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    emotion driver_emotion UNIQUE NOT NULL,
    name TEXT NOT NULL,                    -- Display name
    description TEXT,
    keywords TEXT[],                       -- Keywords for prompt generation
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Formats Table (ABCD - D: Composition Format)
-- ----------------------------------------------------------------------------
CREATE TABLE formats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code format_code UNIQUE NOT NULL,
    name TEXT NOT NULL,                    -- e.g., "Close-up Shot"
    description TEXT,
    aspect_ratio TEXT DEFAULT '16:9',      -- e.g., "16:9", "9:16", "1:1"
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Reference Images Table (Product state reference library)
-- ----------------------------------------------------------------------------
CREATE TABLE reference_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_state product_state NOT NULL,
    image_url TEXT NOT NULL,               -- Supabase Storage URL
    thumbnail_url TEXT,
    title TEXT NOT NULL,
    description TEXT,
    tags TEXT[],
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ref_images_state ON reference_images(product_state) WHERE is_active = true;
CREATE INDEX idx_ref_images_tags ON reference_images USING GIN(tags);

-- ----------------------------------------------------------------------------
-- Creative Projects Table (Main creative configuration workspace)
-- ----------------------------------------------------------------------------
CREATE TABLE creative_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,

    -- ABCD Configuration
    scene_id UUID REFERENCES scenes(id) ON DELETE RESTRICT,
    action_id UUID REFERENCES actions(id) ON DELETE RESTRICT,
    driver_id UUID REFERENCES drivers(id) ON DELETE RESTRICT,
    format_id UUID REFERENCES formats(id) ON DELETE RESTRICT,

    -- Selected reference images
    reference_image_ids UUID[],

    -- AI Generated Content
    gemini_prompt TEXT,                    -- Flux prompt generated by Gemini
    gemini_prompt_metadata JSONB,         -- Parameters used for generation

    -- Naming Convention: YYYYMMDD_[A1]_[A2]_[B]_[C]_[D-Code]
    generated_name TEXT,

    -- Project Metadata
    status generation_status DEFAULT 'pending',
    total_images INTEGER DEFAULT 0,
    completed_images INTEGER DEFAULT 0,

    -- Ownership
    created_by UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_reference_images CHECK (
        reference_image_ids IS NULL OR
        array_length(reference_image_ids, 1) > 0
    )
);

CREATE INDEX idx_projects_user ON creative_projects(created_by);
CREATE INDEX idx_projects_status ON creative_projects(status);
CREATE INDEX idx_projects_created ON creative_projects(created_at DESC);

-- ----------------------------------------------------------------------------
-- Generated Images Table (Batch image generation results)
-- ----------------------------------------------------------------------------
CREATE TABLE generated_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES creative_projects(id) ON DELETE CASCADE,

    -- Image Data
    image_url TEXT NOT NULL,               -- Supabase Storage URL
    thumbnail_url TEXT,
    original_filename TEXT,
    file_size INTEGER,                     -- in bytes
    width INTEGER,
    height INTEGER,

    -- Generation Info
    reference_image_id UUID REFERENCES reference_images(id) ON DELETE SET NULL,
    flux_prompt TEXT,                      -- Actual prompt sent to Flux
    generation_params JSONB,               -- API parameters (strength, steps, etc)

    -- Status
    status generation_status DEFAULT 'pending',
    error_message TEXT,

    -- Performance Tracking
    performance_tier performance_tier,
    performance_score DECIMAL(5,2),        -- CTR or other metrics

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    generated_at TIMESTAMPTZ
);

CREATE INDEX idx_gen_images_project ON generated_images(project_id);
CREATE INDEX idx_gen_images_status ON generated_images(status);
CREATE INDEX idx_gen_images_tier ON generated_images(performance_tier) WHERE performance_tier IS NOT NULL;

-- ----------------------------------------------------------------------------
-- API Usage Logs Table (Cost control & monitoring)
-- ----------------------------------------------------------------------------
CREATE TABLE api_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES creative_projects(id) ON DELETE SET NULL,

    -- API Details
    provider api_provider NOT NULL,
    endpoint TEXT NOT NULL,
    request_payload JSONB,
    response_payload JSONB,

    -- Metrics
    status_code INTEGER,
    latency_ms INTEGER,
    tokens_used INTEGER,                   -- For Gemini
    images_generated INTEGER,              -- For Flux/Nano Banana
    cost_usd DECIMAL(10,4),

    -- Error Handling
    is_success BOOLEAN DEFAULT true,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_logs_user ON api_usage_logs(user_id, created_at DESC);
CREATE INDEX idx_api_logs_provider ON api_usage_logs(provider, created_at DESC);
CREATE INDEX idx_api_logs_project ON api_usage_logs(project_id);

-- ----------------------------------------------------------------------------
-- Performance Data Table (CSV parsed ad performance data)
-- ----------------------------------------------------------------------------
CREATE TABLE performance_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    generated_image_id UUID REFERENCES generated_images(id) ON DELETE SET NULL,

    -- Ad Identifiers
    ad_name TEXT NOT NULL,
    campaign_name TEXT,
    ad_set_name TEXT,

    -- Performance Metrics
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    ctr DECIMAL(5,2),
    conversions INTEGER DEFAULT 0,
    cost_usd DECIMAL(10,2),
    revenue_usd DECIMAL(10,2),
    roas DECIMAL(5,2),

    -- Time Period
    date DATE NOT NULL,
    week_number INTEGER,
    month_number INTEGER,

    -- Metadata
    platform TEXT DEFAULT 'facebook',      -- facebook, google, tiktok
    raw_data JSONB,                        -- Original CSV row

    -- Import Info
    imported_by UUID REFERENCES users(id) ON DELETE SET NULL,
    import_batch_id UUID,                  -- Group imports together

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_perf_data_image ON performance_data(generated_image_id);
CREATE INDEX idx_perf_data_date ON performance_data(date DESC);
CREATE INDEX idx_perf_data_batch ON performance_data(import_batch_id);
CREATE INDEX idx_perf_data_ad_name ON performance_data(ad_name);

-- ----------------------------------------------------------------------------
-- Insights Table (Auto-generated insights from performance data)
-- ----------------------------------------------------------------------------
CREATE TABLE insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Insight Type
    type TEXT NOT NULL CHECK (type IN (
        'top_performer',
        'trend_analysis',
        'abcd_correlation',
        'format_recommendation',
        'scene_effectiveness'
    )),

    -- Insight Content
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    data JSONB,                            -- Supporting data/charts
    confidence_score DECIMAL(3,2),         -- 0.00 to 1.00

    -- Related Entities
    scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
    action_id UUID REFERENCES actions(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    format_id UUID REFERENCES formats(id) ON DELETE SET NULL,

    -- Metadata
    period_start DATE,
    period_end DATE,
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_insights_type ON insights(type, created_at DESC);
CREATE INDEX idx_insights_active ON insights(is_active, created_at DESC);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Update timestamp trigger function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER scenes_updated_at BEFORE UPDATE ON scenes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER actions_updated_at BEFORE UPDATE ON actions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER drivers_updated_at BEFORE UPDATE ON drivers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER formats_updated_at BEFORE UPDATE ON formats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER reference_images_updated_at BEFORE UPDATE ON reference_images
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER creative_projects_updated_at BEFORE UPDATE ON creative_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER generated_images_updated_at BEFORE UPDATE ON generated_images
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER performance_data_updated_at BEFORE UPDATE ON performance_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER insights_updated_at BEFORE UPDATE ON insights
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- Auto-generate project name based on ABCD parameters
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_project_name()
RETURNS TRIGGER AS $$
DECLARE
    date_prefix TEXT;
    scene_category_code TEXT;
    scene_name_code TEXT;
    action_code TEXT;
    driver_code TEXT;
    format_code TEXT;
    scene_cat scene_category;
    scene_nm TEXT;
    action_type_val TEXT;
    driver_emotion_val TEXT;
    format_code_val TEXT;
BEGIN
    -- Date prefix: YYYYMMDD
    date_prefix := TO_CHAR(NOW(), 'YYYYMMDD');

    -- Get scene category and name
    SELECT category, name INTO scene_cat, scene_nm
    FROM scenes WHERE id = NEW.scene_id;

    -- Scene category code (first letter uppercase)
    scene_category_code := UPPER(LEFT(scene_cat::TEXT, 1));

    -- Scene name code (first 3 letters uppercase)
    scene_name_code := UPPER(LEFT(REPLACE(scene_nm, ' ', ''), 3));

    -- Get action type
    SELECT action_type::TEXT INTO action_type_val
    FROM actions WHERE id = NEW.action_id;
    action_code := UPPER(LEFT(action_type_val, 3));

    -- Get driver emotion
    SELECT emotion::TEXT INTO driver_emotion_val
    FROM drivers WHERE id = NEW.driver_id;
    driver_code := UPPER(LEFT(driver_emotion_val, 3));

    -- Get format code
    SELECT code::TEXT INTO format_code_val
    FROM formats WHERE id = NEW.format_id;
    format_code := format_code_val;

    -- Generate name: YYYYMMDD_[A1]_[A2]_[B]_[C]_[D]
    NEW.generated_name := format('%s_%s_%s_%s_%s_%s',
        date_prefix,
        scene_category_code,
        scene_name_code,
        action_code,
        driver_code,
        format_code
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_project_name_trigger
    BEFORE INSERT OR UPDATE OF scene_id, action_id, driver_id, format_id
    ON creative_projects
    FOR EACH ROW
    WHEN (NEW.scene_id IS NOT NULL AND
          NEW.action_id IS NOT NULL AND
          NEW.driver_id IS NOT NULL AND
          NEW.format_id IS NOT NULL)
    EXECUTE FUNCTION generate_project_name();

-- ----------------------------------------------------------------------------
-- Update reference image usage count
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_reference_usage()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.reference_image_id IS NOT NULL THEN
        UPDATE reference_images
        SET usage_count = usage_count + 1
        WHERE id = NEW.reference_image_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_ref_usage_trigger
    AFTER INSERT ON generated_images
    FOR EACH ROW
    EXECUTE FUNCTION increment_reference_usage();

-- ----------------------------------------------------------------------------
-- Update project completion progress
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_project_progress()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE creative_projects
    SET
        completed_images = (
            SELECT COUNT(*)
            FROM generated_images
            WHERE project_id = NEW.project_id
            AND status = 'completed'
        ),
        status = CASE
            WHEN (SELECT COUNT(*) FROM generated_images
                  WHERE project_id = NEW.project_id
                  AND status = 'completed') = total_images
            THEN 'completed'::generation_status
            WHEN (SELECT COUNT(*) FROM generated_images
                  WHERE project_id = NEW.project_id
                  AND status = 'failed') > 0
            THEN 'failed'::generation_status
            ELSE 'processing'::generation_status
        END
    WHERE id = NEW.project_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_progress_trigger
    AFTER INSERT OR UPDATE OF status ON generated_images
    FOR EACH ROW
    EXECUTE FUNCTION update_project_progress();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE formats ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Users Table Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- ABCD Dictionary Tables (Read-only for all authenticated users)
-- ----------------------------------------------------------------------------
CREATE POLICY "All users can view scenes"
    ON scenes FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "All users can view actions"
    ON actions FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "All users can view drivers"
    ON drivers FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "All users can view formats"
    ON formats FOR SELECT
    USING (auth.role() = 'authenticated');

-- Admin-only modification
CREATE POLICY "Admins can modify scenes"
    ON scenes FOR ALL
    USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can modify actions"
    ON actions FOR ALL
    USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can modify drivers"
    ON drivers FOR ALL
    USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can modify formats"
    ON formats FOR ALL
    USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- ----------------------------------------------------------------------------
-- Reference Images Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "All users can view active reference images"
    ON reference_images FOR SELECT
    USING (is_active = true AND auth.role() = 'authenticated');

CREATE POLICY "Users can insert reference images"
    ON reference_images FOR INSERT
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own reference images"
    ON reference_images FOR UPDATE
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can delete reference images"
    ON reference_images FOR DELETE
    USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- ----------------------------------------------------------------------------
-- Creative Projects Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view own projects"
    ON creative_projects FOR SELECT
    USING (auth.uid() = created_by);

CREATE POLICY "Users can create projects"
    ON creative_projects FOR INSERT
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own projects"
    ON creative_projects FOR UPDATE
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own projects"
    ON creative_projects FOR DELETE
    USING (auth.uid() = created_by);

-- ----------------------------------------------------------------------------
-- Generated Images Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view generated images from own projects"
    ON generated_images FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM creative_projects
            WHERE creative_projects.id = generated_images.project_id
            AND creative_projects.created_by = auth.uid()
        )
    );

CREATE POLICY "System can insert generated images"
    ON generated_images FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM creative_projects
            WHERE creative_projects.id = project_id
            AND creative_projects.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can update generated images from own projects"
    ON generated_images FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM creative_projects
            WHERE creative_projects.id = generated_images.project_id
            AND creative_projects.created_by = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- API Usage Logs Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view own API logs"
    ON api_usage_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "System can insert API logs"
    ON api_usage_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all API logs"
    ON api_usage_logs FOR SELECT
    USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- ----------------------------------------------------------------------------
-- Performance Data Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "All users can view performance data"
    ON performance_data FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Users can import performance data"
    ON performance_data FOR INSERT
    WITH CHECK (auth.uid() = imported_by);

CREATE POLICY "Admins can modify performance data"
    ON performance_data FOR ALL
    USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- ----------------------------------------------------------------------------
-- Insights Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "All users can view active insights"
    ON insights FOR SELECT
    USING (is_active = true AND auth.role() = 'authenticated');

CREATE POLICY "Admins can manage insights"
    ON insights FOR ALL
    USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- ============================================================================
-- INITIAL SEED DATA
-- ============================================================================

-- Seed Scenes
INSERT INTO scenes (category, name, description, display_order) VALUES
-- Indoor scenes
('indoor', 'Living Room', 'Comfortable home living room setting', 1),
('indoor', 'Kitchen', 'Modern kitchen environment', 2),
('indoor', 'Bedroom', 'Cozy bedroom setting', 3),
('indoor', 'Bathroom', 'Accessible bathroom space', 4),
-- Outdoor scenes
('outdoor', 'Park', 'Peaceful park with walking paths', 5),
('outdoor', 'Beach', 'Relaxing beach environment', 6),
('outdoor', 'Garden', 'Beautiful garden setting', 7),
('outdoor', 'City Street', 'Urban sidewalk scene', 8),
-- Lifestyle scenes
('lifestyle', 'Shopping Mall', 'Retail shopping environment', 9),
('lifestyle', 'Cafe', 'Casual cafe setting', 10),
('lifestyle', 'Community Center', 'Social gathering space', 11),
-- Product focus
('product_focus', 'Studio White', 'Clean white studio background', 12),
('product_focus', 'Studio Gray', 'Neutral gray studio background', 13);

-- Seed Actions
INSERT INTO actions (name, action_type, product_state, description, display_order) VALUES
('Using Walker Indoors', 'using', 'expanded', 'Person actively using expanded walker indoors', 1),
('Using Walker Outdoors', 'using', 'expanded', 'Person actively using expanded walker outdoors', 2),
('Display Folded Product', 'displaying', 'folded', 'Showcasing compact folded walker', 3),
('Display Expanded Product', 'displaying', 'expanded', 'Showcasing fully opened walker', 4),
('Comparing States', 'comparing', 'both', 'Side-by-side comparison of folded and expanded', 5),
('Unboxing Experience', 'unboxing', 'folded', 'Product unboxing and first impression', 6),
('User Testimonial', 'testimonial', 'expanded', 'Real user sharing experience', 7);

-- Seed Drivers
INSERT INTO drivers (emotion, name, description, keywords, display_order) VALUES
('confidence', 'Confidence', 'Empowering independence and self-assurance',
 ARRAY['confident', 'empowered', 'independent', 'strong'], 1),
('joy', 'Joy', 'Happiness and life enjoyment',
 ARRAY['happy', 'joyful', 'smiling', 'cheerful', 'delighted'], 2),
('relief', 'Relief', 'Comfort and ease of use',
 ARRAY['relieved', 'comfortable', 'easy', 'effortless', 'peaceful'], 3),
('independence', 'Independence', 'Freedom and mobility',
 ARRAY['free', 'mobile', 'autonomous', 'self-reliant'], 4),
('safety', 'Safety', 'Security and stability',
 ARRAY['safe', 'secure', 'stable', 'reliable', 'protected'], 5),
('elegance', 'Elegance', 'Style and sophistication',
 ARRAY['elegant', 'stylish', 'sophisticated', 'modern', 'sleek'], 6);

-- Seed Formats
INSERT INTO formats (code, name, description, aspect_ratio, display_order) VALUES
('CU', 'Close-up Shot', 'Tight frame focusing on product details or facial expressions', '16:9', 1),
('MS', 'Medium Shot', 'Waist-up or product in context', '16:9', 2),
('FS', 'Full Shot', 'Full body or complete product view', '16:9', 3),
('OTS', 'Over The Shoulder', 'Perspective from behind user', '16:9', 4),
('POV', 'Point of View', 'First-person perspective', '16:9', 5);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Full-text search indexes
CREATE INDEX idx_scenes_name_trgm ON scenes USING GIN(name gin_trgm_ops);
CREATE INDEX idx_actions_name_trgm ON actions USING GIN(name gin_trgm_ops);
CREATE INDEX idx_projects_name_trgm ON creative_projects USING GIN(name gin_trgm_ops);

-- Composite indexes for common queries
CREATE INDEX idx_projects_user_status ON creative_projects(created_by, status, created_at DESC);
CREATE INDEX idx_gen_images_project_status ON generated_images(project_id, status);
CREATE INDEX idx_perf_data_date_platform ON performance_data(date DESC, platform);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Complete project view with all ABCD details
CREATE VIEW v_projects_full AS
SELECT
    p.id,
    p.name,
    p.description,
    p.generated_name,
    p.status,
    p.total_images,
    p.completed_images,
    -- Scene details
    s.category AS scene_category,
    s.name AS scene_name,
    -- Action details
    a.name AS action_name,
    a.action_type,
    a.product_state,
    -- Driver details
    d.emotion AS driver_emotion,
    d.name AS driver_name,
    -- Format details
    f.code AS format_code,
    f.name AS format_name,
    f.aspect_ratio,
    -- User details
    u.email AS creator_email,
    u.full_name AS creator_name,
    -- Timestamps
    p.created_at,
    p.updated_at
FROM creative_projects p
LEFT JOIN scenes s ON p.scene_id = s.id
LEFT JOIN actions a ON p.action_id = a.id
LEFT JOIN drivers d ON p.driver_id = d.id
LEFT JOIN formats f ON p.format_id = f.id
LEFT JOIN users u ON p.created_by = u.id;

-- Performance summary by image
CREATE VIEW v_image_performance AS
SELECT
    gi.id AS image_id,
    gi.project_id,
    gi.image_url,
    gi.status,
    -- Performance metrics
    AVG(pd.ctr) AS avg_ctr,
    SUM(pd.impressions) AS total_impressions,
    SUM(pd.clicks) AS total_clicks,
    SUM(pd.conversions) AS total_conversions,
    SUM(pd.cost_usd) AS total_cost,
    SUM(pd.revenue_usd) AS total_revenue,
    AVG(pd.roas) AS avg_roas,
    -- Tier
    gi.performance_tier,
    -- Dates
    MIN(pd.date) AS first_run_date,
    MAX(pd.date) AS last_run_date
FROM generated_images gi
LEFT JOIN performance_data pd ON gi.id = pd.generated_image_id
GROUP BY gi.id, gi.project_id, gi.image_url, gi.status, gi.performance_tier;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE creative_projects IS 'Main creative configuration workspace combining ABCD parameters';
COMMENT ON TABLE generated_images IS 'Batch-generated images from Flux/Nano Banana API';
COMMENT ON TABLE reference_images IS 'Library of reference images for Img2Img generation';
COMMENT ON TABLE performance_data IS 'Imported ad performance metrics from CSV files';
COMMENT ON TABLE api_usage_logs IS 'API call tracking for cost control and monitoring';
COMMENT ON TABLE insights IS 'Auto-generated insights from performance analysis';

COMMENT ON COLUMN creative_projects.generated_name IS 'Auto-generated name following YYYYMMDD_[A1]_[A2]_[B]_[C]_[D-Code] pattern';
COMMENT ON COLUMN actions.product_state IS 'Determines which reference images to show (expanded/folded/both)';
COMMENT ON COLUMN api_usage_logs.cost_usd IS 'Estimated cost in USD for API call';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
