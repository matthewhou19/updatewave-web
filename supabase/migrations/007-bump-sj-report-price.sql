-- Migration 007: Bump SJ 2025 report price $349 -> $499
-- Run this in Supabase SQL Editor against the production project.
--
-- Migration 002 seeded the San Jose report at the $349 launch price
-- (price_cents = 34900). The product price is now $499 (49900), matching
-- src/lib/pricing.ts (sj-report.priceCents) and the /pricing comparison page.
-- This realigns the city_lists row so the /list landing page and Stripe
-- checkout both reflect the displayed price.
--
-- anchor_price_cents stays 49900: with price_cents == anchor_price_cents the
-- list page's `launchPrice < anchorPrice` discount check is false, so no
-- strikethrough renders (clean "$499"). The anchor remains the regular price
-- for any future sale.
--
-- Production was already corrected via the Supabase REST API on 2026-06-19;
-- this migration keeps fresh local/CI databases (db-init.sh) in sync and
-- records the change in version control. Idempotent: a no-op once price is 49900.

UPDATE city_lists
SET price_cents = 49900
WHERE city = 'sj' AND year = 2025 AND service_tier = 'report';
