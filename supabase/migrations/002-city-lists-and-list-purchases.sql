-- Migration 002: City lists + list purchases (developer-concentration reports)
-- Run this in Supabase SQL Editor against the production project.
--
-- Adds the data model for the new $349 city market structure report product.
-- Schema is intentionally minimal: marketing copy lives in description (markdown),
-- killer-insight + sample charts are baked into the landing page component for v1.
--
-- Idempotent: uses CREATE TABLE IF NOT EXISTS, ON CONFLICT DO NOTHING for seed,
-- DROP POLICY IF EXISTS before CREATE POLICY.

-- ============================================================
-- Step 1: city_lists table
-- ============================================================
CREATE TABLE IF NOT EXISTS city_lists (
  id BIGSERIAL PRIMARY KEY,
  city TEXT NOT NULL,                    -- URL slug: 'sj', 'sf', 'fremont'
  year INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,                      -- Marketing copy (markdown OK)
  headline_insight TEXT,                 -- The single killer-insight sentence shown on the landing page
  headline_insight_subtext TEXT,         -- Optional second paragraph under the killer insight
  price_cents INTEGER NOT NULL,          -- 34900 = $349
  anchor_price_cents INTEGER,            -- Optional strikethrough anchor (e.g. 49900 = $499)
  pdf_storage_path TEXT NOT NULL,        -- Path inside city-lists-pdfs bucket
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(city, year)
);

CREATE INDEX IF NOT EXISTS idx_city_lists_city_active
  ON city_lists(city) WHERE active = true;

-- ============================================================
-- Step 2: list_purchases table (idempotency via UNIQUE)
-- ============================================================
CREATE TABLE IF NOT EXISTS list_purchases (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  city_list_id BIGINT NOT NULL REFERENCES city_lists(id),
  stripe_session_id TEXT NOT NULL UNIQUE,  -- second-line idempotency for Stripe replay
  stripe_payment_id TEXT,
  amount_cents INTEGER NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, city_list_id)
);

-- Note: the UNIQUE(user_id, city_list_id) constraint already creates a btree
-- index covering both columns, so no separate index is needed for that lookup.

-- ============================================================
-- Step 3: RLS on city_lists (anon can read PUBLIC columns only)
-- ============================================================
ALTER TABLE city_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "city_lists_anon_read_public" ON city_lists;
CREATE POLICY "city_lists_anon_read_public" ON city_lists
  FOR SELECT
  TO anon
  USING (active = true);

DROP POLICY IF EXISTS "city_lists_service_role_all" ON city_lists;
CREATE POLICY "city_lists_service_role_all" ON city_lists
  FOR ALL
  TO service_role
  USING (true);

-- Note: pdf_storage_path is a column on city_lists. RLS row-level filtering
-- can't hide a single column from anon. We rely on application-layer column
-- selection (CITY_LIST_PUBLIC_COLUMNS in src/lib/queries.ts) for defense-in-depth,
-- and on Storage bucket RLS (Step 5 below) for the actual access control.

-- ============================================================
-- Step 4: RLS on list_purchases (service role only)
-- ============================================================
ALTER TABLE list_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "list_purchases_service_role_all" ON list_purchases;
CREATE POLICY "list_purchases_service_role_all" ON list_purchases
  FOR ALL
  TO service_role
  USING (true);

-- ============================================================
-- Step 5: Storage bucket city-lists-pdfs (private, service-role-only)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('city-lists-pdfs', 'city-lists-pdfs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "city_lists_pdfs_service_role_only" ON storage.objects;
CREATE POLICY "city_lists_pdfs_service_role_only" ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'city-lists-pdfs');

-- Anon and authenticated have NO read policy on this bucket. Only the
-- service-role-issued signed URLs can be used to download files.

-- ============================================================
-- Step 6: updated_at trigger (mirrors projects table pattern)
-- ============================================================
CREATE OR REPLACE FUNCTION update_city_lists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS city_lists_set_updated_at ON city_lists;
CREATE TRIGGER city_lists_set_updated_at
  BEFORE UPDATE ON city_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_city_lists_updated_at();

-- ============================================================
-- Step 7: Seed San Jose 2025 list
-- ============================================================
INSERT INTO city_lists (
  city, year, title, description,
  headline_insight, headline_insight_subtext,
  price_cents, anchor_price_cents,
  pdf_storage_path, active
)
VALUES (
  'sj',
  2025,
  'San Jose 2025 GC Market Structure Report',
  'Stop chasing architects. This 15-page report shows you the 6 LLCs that hold 75% of San Jose SFR new construction, why ADU is a 489-owner B2C market with zero channel leverage, and exactly which developers to approach for each tier of the market. Built from 621 permits filed Jan 2025 through April 2026.',
  '75% of San Jose SFR new construction is held by 6 multi-property owners. To win SFR work, contact the developers — not the architects, not the listed owners.',
  'The full report shows the same structural call for ADU (489 owners, fragmented B2C, no channel leverage), and Multifamily (top 5 developers hold 59%). Three tiers, three different GC playbooks.',
  34900,
  49900,
  'sj-2025.pdf',
  true
)
ON CONFLICT (city, year) DO NOTHING;
