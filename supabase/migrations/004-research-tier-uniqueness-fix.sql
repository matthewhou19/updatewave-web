-- Migration 004: Allow multiple service tiers per (city, year) + seed SJ research SKU
--
-- Migration 002 created UNIQUE(city, year) on city_lists. With Lane A's
-- service_tier column (migration 003), we now need TWO rows for SJ 2025:
--   - service_tier='report'   priced at $349  (existing $349 SJ report SKU)
--   - service_tier='research' priced at $1999 (new $1999 SJ research+monitoring SKU)
--
-- The (city, year) constraint blocks the second row. Replace it with a
-- (city, year, service_tier) constraint that allows one row per SKU.
--
-- Idempotent: DROP CONSTRAINT IF EXISTS, conditional ADD CONSTRAINT in DO
-- block (ALTER TABLE ADD CONSTRAINT does not support IF NOT EXISTS), and
-- ON CONFLICT DO NOTHING on the seed insert. Re-running is a no-op.
--
-- Run order: must run AFTER 003 (depends on city_lists.service_tier column).

-- ============================================================
-- Step 1: Drop the old (city, year) unique constraint
-- ============================================================
-- Postgres auto-names UNIQUE constraints from inline column declarations as
-- <table>_<col1>_<col2>_key. Migration 002 declared `UNIQUE(city, year)` so
-- the constraint is named city_lists_city_year_key.
ALTER TABLE city_lists DROP CONSTRAINT IF EXISTS city_lists_city_year_key;

-- ============================================================
-- Step 2: Add the new (city, year, service_tier) unique constraint
-- ============================================================
-- ALTER TABLE ADD CONSTRAINT does NOT support IF NOT EXISTS in Postgres.
-- Use a DO block with a pg_constraint check to make this idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'city_lists_city_year_service_tier_key'
  ) THEN
    ALTER TABLE city_lists
      ADD CONSTRAINT city_lists_city_year_service_tier_key
      UNIQUE (city, year, service_tier);
  END IF;
END $$;

-- ============================================================
-- Step 3: Seed the SJ 2025 research SKU at $1999
-- ============================================================
-- This row is the $1,999 "Custom Research + 90-Day Monitoring" product for
-- San Jose. Same underlying PDF as the $349 report (sj-2025.pdf), but bundled
-- with 90 days of weekly permit-monitoring digests.
--
-- delivery_window_days IS NULL signals "instant download" (PDF in stock).
-- handleResearchPurchase auto-flips delivery_status='delivered' on insert
-- when delivery_window_days IS NULL (per design Locked Decision #14).
INSERT INTO city_lists (
  city, year, title, description,
  headline_insight, headline_insight_subtext,
  price_cents, anchor_price_cents,
  pdf_storage_path, service_tier, delivery_window_days, active
)
VALUES (
  'sj',
  2025,
  'San Jose 2025 Custom Research + 90-Day Permit Monitoring',
  'The full San Jose 2025 GC Market Structure Report (12 months historical, 621 permits) plus 90 days of weekly digests covering every notable new permit filed in San Jose, with founder commentary on what each one means for your GC business.',
  'Get the same SJ market structure analysis our $349 customers love, plus an ongoing intelligence stream so you''re first to act on new construction in San Jose.',
  'Weekly digest emails for 90 days from purchase. Curated by Matthew, not auto-generated. Covers ADU, SFR, and Multifamily filings as they hit public records.',
  199900,
  NULL,
  'sj-2025.pdf',
  'research',
  NULL,
  true
)
ON CONFLICT (city, year, service_tier) DO NOTHING;
