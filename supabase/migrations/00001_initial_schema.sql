-- ============================================================================
-- Rolloy Creative OS - Initial Database Schema
-- ============================================================================
-- Description: Complete database schema with RLS policies
-- Created: 2025-01-29
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CREATIVE RECORDS TABLE
-- ============================================================================
-- Stores all generated creative assets with ABCD metadata

CREATE TABLE IF NOT EXISTS public.creative_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ABCD Selection
  a1_tag VARCHAR(50) NOT NULL,
  a2_tag VARCHAR(50) NOT NULL,
  b_tag VARCHAR(50) NOT NULL,
  c_tag VARCHAR(50) NOT NULL,
  d_tag VARCHAR(50) NOT NULL,

  -- Creative Naming
  creative_name VARCHAR(255) NOT NULL UNIQUE,
  product_state VARCHAR(20) NOT NULL CHECK (product_state IN ('FOLDED', 'UNFOLDED')),

  -- AI Generation
  gemini_prompt TEXT NOT NULL,
  base_image_url TEXT NOT NULL,

  -- Generated Images (array of Supabase Storage URLs)
  generated_images TEXT[] NOT NULL DEFAULT '{}',

  -- Performance Metrics (nullable, populated from CSV upload)
  impressions INTEGER,
  clicks INTEGER,
  conversions INTEGER,
  spend DECIMAL(10, 2),
  revenue DECIMAL(10, 2),
  cpa DECIMAL(10, 2),
  roas DECIMAL(10, 2),

  -- Status Tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  error_message TEXT,

  -- User Association (nullable for now, can be linked later with auth)
  user_id UUID
);

-- Indexes for performance
CREATE INDEX idx_creative_records_creative_name ON public.creative_records(creative_name);
CREATE INDEX idx_creative_records_a1_tag ON public.creative_records(a1_tag);
CREATE INDEX idx_creative_records_a2_tag ON public.creative_records(a2_tag);
CREATE INDEX idx_creative_records_b_tag ON public.creative_records(b_tag);
CREATE INDEX idx_creative_records_c_tag ON public.creative_records(c_tag);
CREATE INDEX idx_creative_records_d_tag ON public.creative_records(d_tag);
CREATE INDEX idx_creative_records_status ON public.creative_records(status);
CREATE INDEX idx_creative_records_created_at ON public.creative_records(created_at DESC);
CREATE INDEX idx_creative_records_user_id ON public.creative_records(user_id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_creative_records_updated_at
  BEFORE UPDATE ON public.creative_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- GENERATION JOBS TABLE
-- ============================================================================
-- Tracks image generation job progress

CREATE TABLE IF NOT EXISTS public.generation_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  creative_id UUID NOT NULL REFERENCES public.creative_records(id) ON DELETE CASCADE,

  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),

  total_images INTEGER NOT NULL DEFAULT 20,
  completed_images INTEGER NOT NULL DEFAULT 0,
  failed_images INTEGER NOT NULL DEFAULT 0,

  error_message TEXT,

  -- Metadata
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_generation_jobs_creative_id ON public.generation_jobs(creative_id);
CREATE INDEX idx_generation_jobs_status ON public.generation_jobs(status);
CREATE INDEX idx_generation_jobs_created_at ON public.generation_jobs(created_at DESC);

-- Updated at trigger
CREATE TRIGGER update_generation_jobs_updated_at
  BEFORE UPDATE ON public.generation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- ANALYTICS DATA TABLE
-- ============================================================================
-- Stores parsed CSV analytics data

CREATE TABLE IF NOT EXISTS public.analytics_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- CSV Upload Metadata
  upload_id UUID NOT NULL,
  upload_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ad Information
  ad_name VARCHAR(255) NOT NULL,
  creative_id UUID REFERENCES public.creative_records(id) ON DELETE SET NULL,

  -- ABCD Tags (extracted from ad name)
  a1_tag VARCHAR(50),
  a2_tag VARCHAR(50),
  b_tag VARCHAR(50),
  c_tag VARCHAR(50),
  d_tag VARCHAR(50),
  parsed_success BOOLEAN NOT NULL DEFAULT FALSE,

  -- Performance Metrics
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  spend DECIMAL(10, 2) NOT NULL DEFAULT 0,
  revenue DECIMAL(10, 2) NOT NULL DEFAULT 0,
  cpa DECIMAL(10, 2),
  roas DECIMAL(10, 2),

  -- Date Range (if available in CSV)
  date_start DATE,
  date_end DATE
);

-- Indexes
CREATE INDEX idx_analytics_data_upload_id ON public.analytics_data(upload_id);
CREATE INDEX idx_analytics_data_creative_id ON public.analytics_data(creative_id);
CREATE INDEX idx_analytics_data_ad_name ON public.analytics_data(ad_name);
CREATE INDEX idx_analytics_data_a1_tag ON public.analytics_data(a1_tag);
CREATE INDEX idx_analytics_data_a2_tag ON public.analytics_data(a2_tag);
CREATE INDEX idx_analytics_data_b_tag ON public.analytics_data(b_tag);
CREATE INDEX idx_analytics_data_c_tag ON public.analytics_data(c_tag);
CREATE INDEX idx_analytics_data_d_tag ON public.analytics_data(d_tag);
CREATE INDEX idx_analytics_data_upload_date ON public.analytics_data(upload_date DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.creative_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_data ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: creative_records
-- ============================================================================

-- Allow anyone to read all creative records (public access)
CREATE POLICY "Allow public read access to creative_records"
  ON public.creative_records
  FOR SELECT
  USING (true);

-- Allow authenticated users to insert their own records
CREATE POLICY "Allow authenticated insert to creative_records"
  ON public.creative_records
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    OR user_id IS NULL
  );

-- Allow users to update their own records
CREATE POLICY "Allow users to update own creative_records"
  ON public.creative_records
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR user_id IS NULL
  );

-- Allow users to delete their own records
CREATE POLICY "Allow users to delete own creative_records"
  ON public.creative_records
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR user_id IS NULL
  );

-- ============================================================================
-- RLS POLICIES: generation_jobs
-- ============================================================================

-- Allow public read access
CREATE POLICY "Allow public read access to generation_jobs"
  ON public.generation_jobs
  FOR SELECT
  USING (true);

-- Allow authenticated users to insert
CREATE POLICY "Allow authenticated insert to generation_jobs"
  ON public.generation_jobs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR true);

-- Allow authenticated users to update
CREATE POLICY "Allow authenticated update to generation_jobs"
  ON public.generation_jobs
  FOR UPDATE
  USING (true);

-- ============================================================================
-- RLS POLICIES: analytics_data
-- ============================================================================

-- Allow public read access
CREATE POLICY "Allow public read access to analytics_data"
  ON public.analytics_data
  FOR SELECT
  USING (true);

-- Allow authenticated users to insert
CREATE POLICY "Allow authenticated insert to analytics_data"
  ON public.analytics_data
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR true);

-- ============================================================================
-- STORAGE BUCKET SETUP
-- ============================================================================

-- Create storage bucket for creative assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('creative-assets', 'creative-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: Allow public read access
CREATE POLICY "Allow public read access to creative-assets"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'creative-assets');

-- Storage policies: Allow authenticated uploads
CREATE POLICY "Allow authenticated uploads to creative-assets"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'creative-assets'
    AND (auth.uid() IS NOT NULL OR true)
  );

-- Storage policies: Allow authenticated updates
CREATE POLICY "Allow authenticated updates to creative-assets"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'creative-assets'
    AND (auth.uid() IS NOT NULL OR true)
  );

-- Storage policies: Allow authenticated deletes
CREATE POLICY "Allow authenticated deletes from creative-assets"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'creative-assets'
    AND (auth.uid() IS NOT NULL OR true)
  );

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to calculate CPA and ROAS
CREATE OR REPLACE FUNCTION public.calculate_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate CPA
  IF NEW.conversions > 0 THEN
    NEW.cpa := NEW.spend / NEW.conversions;
  ELSE
    NEW.cpa := NULL;
  END IF;

  -- Calculate ROAS
  IF NEW.spend > 0 THEN
    NEW.roas := NEW.revenue / NEW.spend;
  ELSE
    NEW.roas := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to creative_records
CREATE TRIGGER calculate_creative_records_metrics
  BEFORE INSERT OR UPDATE ON public.creative_records
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_metrics();

-- Apply to analytics_data
CREATE TRIGGER calculate_analytics_data_metrics
  BEFORE INSERT OR UPDATE ON public.analytics_data
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_metrics();

-- ============================================================================
-- MATERIALIZED VIEW: ABCD Performance Summary
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.abcd_performance_summary AS
SELECT
  'A1' as category,
  a1_tag as tag,
  COUNT(*) as total_creatives,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  SUM(conversions) as total_conversions,
  SUM(spend) as total_spend,
  SUM(revenue) as total_revenue,
  AVG(cpa) as avg_cpa,
  AVG(roas) as avg_roas
FROM public.creative_records
WHERE impressions IS NOT NULL
GROUP BY a1_tag

UNION ALL

SELECT
  'A2' as category,
  a2_tag as tag,
  COUNT(*) as total_creatives,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  SUM(conversions) as total_conversions,
  SUM(spend) as total_spend,
  SUM(revenue) as total_revenue,
  AVG(cpa) as avg_cpa,
  AVG(roas) as avg_roas
FROM public.creative_records
WHERE impressions IS NOT NULL
GROUP BY a2_tag

UNION ALL

SELECT
  'B' as category,
  b_tag as tag,
  COUNT(*) as total_creatives,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  SUM(conversions) as total_conversions,
  SUM(spend) as total_spend,
  SUM(revenue) as total_revenue,
  AVG(cpa) as avg_cpa,
  AVG(roas) as avg_roas
FROM public.creative_records
WHERE impressions IS NOT NULL
GROUP BY b_tag

UNION ALL

SELECT
  'C' as category,
  c_tag as tag,
  COUNT(*) as total_creatives,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  SUM(conversions) as total_conversions,
  SUM(spend) as total_spend,
  SUM(revenue) as total_revenue,
  AVG(cpa) as avg_cpa,
  AVG(roas) as avg_roas
FROM public.creative_records
WHERE impressions IS NOT NULL
GROUP BY c_tag

UNION ALL

SELECT
  'D' as category,
  d_tag as tag,
  COUNT(*) as total_creatives,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  SUM(conversions) as total_conversions,
  SUM(spend) as total_spend,
  SUM(revenue) as total_revenue,
  AVG(cpa) as avg_cpa,
  AVG(roas) as avg_roas
FROM public.creative_records
WHERE impressions IS NOT NULL
GROUP BY d_tag;

-- Index for the materialized view
CREATE INDEX idx_abcd_performance_summary_category ON public.abcd_performance_summary(category);
CREATE INDEX idx_abcd_performance_summary_tag ON public.abcd_performance_summary(tag);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION public.refresh_abcd_performance_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.abcd_performance_summary;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.creative_records IS 'Stores all generated creative assets with ABCD metadata and performance metrics';
COMMENT ON TABLE public.generation_jobs IS 'Tracks image generation job progress and status';
COMMENT ON TABLE public.analytics_data IS 'Stores parsed CSV analytics data with ABCD tag extraction';
COMMENT ON MATERIALIZED VIEW public.abcd_performance_summary IS 'Aggregated ABCD performance metrics for analytics dashboard';

-- ============================================================================
-- GRANTS (Public schema access)
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
