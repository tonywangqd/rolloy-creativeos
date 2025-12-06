-- ============================================================================
-- Rolloy Creative OS - Generation Sessions Migration
-- ============================================================================
-- Description: Conversation-based generation history system
-- Version: 1.0
-- Date: 2025-12-06
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Session status
CREATE TYPE session_status AS ENUM (
    'draft',           -- Session created, not started
    'in_progress',     -- Generation in progress
    'paused',          -- User paused generation
    'completed',       -- All images generated
    'cancelled',       -- User cancelled
    'failed'           -- Generation failed
);

-- Image generation status
CREATE TYPE image_generation_status AS ENUM (
    'pending',         -- Queued for generation
    'generating',      -- Currently being generated
    'success',         -- Successfully generated
    'failed',          -- Generation failed
    'cancelled'        -- Cancelled by user
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Generation Sessions Table
-- ----------------------------------------------------------------------------
CREATE TABLE generation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Session Metadata
    creative_name TEXT NOT NULL,                     -- ABCD naming: YYYYMMDD_A1_A2_B_C_D
    description TEXT,                                -- Optional user description

    -- ABCD Configuration (stored as JSON for flexibility)
    abcd_selection JSONB NOT NULL,                   -- {A1, A2, B, C, D}

    -- Generation Parameters
    prompt TEXT NOT NULL,                            -- Gemini-generated Flux prompt
    product_state TEXT NOT NULL                      -- 'FOLDED' or 'UNFOLDED'
        CHECK (product_state IN ('FOLDED', 'UNFOLDED')),
    reference_image_url TEXT NOT NULL,               -- Base reference image URL

    -- Session Status & Progress
    status session_status DEFAULT 'draft' NOT NULL,
    total_images INTEGER DEFAULT 20 NOT NULL         -- Target count (usually 20)
        CHECK (total_images > 0 AND total_images <= 100),
    generated_count INTEGER DEFAULT 0 NOT NULL       -- Successfully generated count
        CHECK (generated_count >= 0),
    failed_count INTEGER DEFAULT 0 NOT NULL          -- Failed generation count
        CHECK (failed_count >= 0),

    -- Generation Settings
    strength DECIMAL(3,2) DEFAULT 0.75               -- Img2Img strength (0.0-1.0)
        CHECK (strength >= 0.0 AND strength <= 1.0),
    seed INTEGER,                                    -- Optional seed for reproducibility

    -- Error Tracking
    error_message TEXT,                              -- Last error message
    retry_count INTEGER DEFAULT 0,                   -- Number of retries

    -- Ownership & Timestamps
    created_by UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    started_at TIMESTAMPTZ,                          -- When generation first started
    completed_at TIMESTAMPTZ,                        -- When fully completed
    paused_at TIMESTAMPTZ                            -- When last paused
);

-- Indexes for performance
CREATE INDEX idx_sessions_status ON generation_sessions(status, created_at DESC);
CREATE INDEX idx_sessions_user ON generation_sessions(created_by, created_at DESC);
CREATE INDEX idx_sessions_name ON generation_sessions(creative_name);
CREATE INDEX idx_sessions_abcd ON generation_sessions USING GIN(abcd_selection);

-- Full-text search on creative name
CREATE INDEX idx_sessions_name_trgm ON generation_sessions USING GIN(creative_name gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- Generated Images Table
-- ----------------------------------------------------------------------------
CREATE TABLE generated_images_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Session Relationship
    session_id UUID NOT NULL REFERENCES generation_sessions(id) ON DELETE CASCADE,

    -- Image Index (1-based: 1, 2, 3, ..., 20)
    image_index INTEGER NOT NULL
        CHECK (image_index > 0 AND image_index <= 100),

    -- Storage URLs
    storage_url TEXT,                                -- Supabase Storage public URL
    storage_path TEXT,                               -- Storage path (e.g., generated/name/01.png)

    -- Image Metadata
    file_size INTEGER,                               -- Size in bytes
    width INTEGER,                                   -- Image width
    height INTEGER,                                  -- Image height
    mime_type TEXT DEFAULT 'image/png',              -- MIME type

    -- Generation Status
    status image_generation_status DEFAULT 'pending' NOT NULL,
    error_message TEXT,                              -- Specific error for this image
    retry_count INTEGER DEFAULT 0,                   -- Retry count for this image

    -- Generation Details
    actual_prompt TEXT,                              -- Actual prompt used (may include variations)
    generation_params JSONB,                         -- API parameters (strength, seed, etc.)
    generation_duration_ms INTEGER,                  -- How long generation took

    -- AI Provider Info
    provider TEXT DEFAULT 'gemini',                  -- 'gemini', 'flux', etc.
    model_version TEXT,                              -- e.g., 'gemini-2.0-flash-exp'

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    generated_at TIMESTAMPTZ                         -- When successfully generated
);

-- Indexes for performance
CREATE INDEX idx_gen_images_session ON generated_images_v2(session_id, image_index);
CREATE INDEX idx_gen_images_status ON generated_images_v2(status);
CREATE UNIQUE INDEX idx_gen_images_session_index ON generated_images_v2(session_id, image_index);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Auto-update updated_at timestamp
-- ----------------------------------------------------------------------------
CREATE TRIGGER sessions_updated_at BEFORE UPDATE ON generation_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER gen_images_v2_updated_at BEFORE UPDATE ON generated_images_v2
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- Update session progress when image status changes
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_session_progress()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE generation_sessions
    SET
        generated_count = (
            SELECT COUNT(*)
            FROM generated_images_v2
            WHERE session_id = NEW.session_id
            AND status = 'success'
        ),
        failed_count = (
            SELECT COUNT(*)
            FROM generated_images_v2
            WHERE session_id = NEW.session_id
            AND status = 'failed'
        ),
        -- Auto-update status to completed when all images are done
        status = CASE
            WHEN (
                SELECT COUNT(*)
                FROM generated_images_v2
                WHERE session_id = NEW.session_id
                AND status = 'success'
            ) >= total_images
            THEN 'completed'::session_status

            -- Auto-mark as failed if too many failures
            WHEN (
                SELECT COUNT(*)
                FROM generated_images_v2
                WHERE session_id = NEW.session_id
                AND status = 'failed'
            ) > (total_images * 0.5)
            THEN 'failed'::session_status

            ELSE status
        END,
        -- Set completed_at when all images are done
        completed_at = CASE
            WHEN (
                SELECT COUNT(*)
                FROM generated_images_v2
                WHERE session_id = NEW.session_id
                AND status = 'success'
            ) >= total_images
            AND completed_at IS NULL
            THEN NOW()
            ELSE completed_at
        END
    WHERE id = NEW.session_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_session_progress_trigger
    AFTER INSERT OR UPDATE OF status ON generated_images_v2
    FOR EACH ROW
    EXECUTE FUNCTION update_session_progress();

-- ----------------------------------------------------------------------------
-- Set started_at timestamp when first image generation starts
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_session_started_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'in_progress' AND OLD.started_at IS NULL THEN
        NEW.started_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_session_started_at_trigger
    BEFORE UPDATE OF status ON generation_sessions
    FOR EACH ROW
    EXECUTE FUNCTION set_session_started_at();

-- ----------------------------------------------------------------------------
-- Set paused_at timestamp when session is paused
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_session_paused_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'paused' THEN
        NEW.paused_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_session_paused_at_trigger
    BEFORE UPDATE OF status ON generation_sessions
    FOR EACH ROW
    EXECUTE FUNCTION set_session_paused_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE generation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_images_v2 ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Generation Sessions Policies
-- ----------------------------------------------------------------------------

-- Public read access (no auth required for now)
CREATE POLICY "Public can view all sessions"
    ON generation_sessions FOR SELECT
    USING (true);

-- Public can create sessions
CREATE POLICY "Public can create sessions"
    ON generation_sessions FOR INSERT
    WITH CHECK (true);

-- Public can update sessions
CREATE POLICY "Public can update sessions"
    ON generation_sessions FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Public can delete sessions
CREATE POLICY "Public can delete sessions"
    ON generation_sessions FOR DELETE
    USING (true);

-- ----------------------------------------------------------------------------
-- Generated Images Policies
-- ----------------------------------------------------------------------------

-- Public read access
CREATE POLICY "Public can view all generated images"
    ON generated_images_v2 FOR SELECT
    USING (true);

-- Public can insert images
CREATE POLICY "Public can insert generated images"
    ON generated_images_v2 FOR INSERT
    WITH CHECK (true);

-- Public can update images
CREATE POLICY "Public can update generated images"
    ON generated_images_v2 FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Public can delete images
CREATE POLICY "Public can delete generated images"
    ON generated_images_v2 FOR DELETE
    USING (true);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Session Summary View (with image counts and progress)
-- ----------------------------------------------------------------------------
CREATE VIEW v_session_summary AS
SELECT
    s.id,
    s.creative_name,
    s.description,
    s.abcd_selection,
    s.prompt,
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
-- HELPER FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Create initial image records for a session
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_session_images(
    p_session_id UUID,
    p_total_images INTEGER
)
RETURNS INTEGER AS $$
DECLARE
    i INTEGER;
    inserted_count INTEGER := 0;
BEGIN
    FOR i IN 1..p_total_images LOOP
        INSERT INTO generated_images_v2 (session_id, image_index, status)
        VALUES (p_session_id, i, 'pending');
        inserted_count := inserted_count + 1;
    END LOOP;

    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Get next pending image for generation
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_next_pending_image(
    p_session_id UUID
)
RETURNS TABLE (
    id UUID,
    image_index INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT gi.id, gi.image_index
    FROM generated_images_v2 gi
    WHERE gi.session_id = p_session_id
    AND gi.status = 'pending'
    ORDER BY gi.image_index ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE generation_sessions IS 'Conversation-based generation sessions for tracking image generation history';
COMMENT ON TABLE generated_images_v2 IS 'Individual generated images within a session';
COMMENT ON COLUMN generation_sessions.creative_name IS 'ABCD naming convention: YYYYMMDD_A1_A2_B_C_D';
COMMENT ON COLUMN generation_sessions.abcd_selection IS 'JSON object containing ABCD selections: {A1, A2, B, C, D}';
COMMENT ON COLUMN generated_images_v2.image_index IS '1-based index (1-20) representing the image number in the batch';
COMMENT ON COLUMN generated_images_v2.storage_url IS 'Public URL from Supabase Storage';
COMMENT ON COLUMN generated_images_v2.storage_path IS 'Storage path: generated/{creativeName}/{01-20}.png';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
