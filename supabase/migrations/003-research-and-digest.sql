-- Migration 003: $1999 city research product + email digest infrastructure
-- Run this in Supabase SQL Editor against the production project.
--
-- Adds the data model for the new $1999 custom city research SKU and the
-- supporting weekly email digest (90-day post-purchase monitoring).
--
-- Idempotent: uses CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD COLUMN IF NOT
-- EXISTS, DROP POLICY IF EXISTS before CREATE POLICY, DROP TRIGGER IF EXISTS
-- before CREATE TRIGGER.
--
-- FK type contract (CRITICAL): all new tables use BIGSERIAL primary keys with
-- BIGINT foreign keys. Matches existing migrations 001 and 002. Webhook code
-- relies on `parseInt(metadata.user_id, 10)` (see src/app/api/webhook/route.ts
-- line ~148), so any new FK MUST stay numeric, not UUID.

-- ============================================================
-- Step 1: Extend city_lists to support both 'report' and 'research' tiers
-- ============================================================
ALTER TABLE city_lists
  ADD COLUMN IF NOT EXISTS service_tier TEXT NOT NULL DEFAULT 'report'
  CHECK (service_tier IN ('report', 'research'));

ALTER TABLE city_lists
  ADD COLUMN IF NOT EXISTS delivery_window_days INTEGER;
  -- NULL for instant SKUs (existing $349 SJ row has a pre-built PDF, so NULL).
  -- 5-10 for research products that begin work after purchase.

-- ============================================================
-- Step 2: research_purchases table (parallel to list_purchases, BIGINT FKs)
-- ============================================================
CREATE TABLE IF NOT EXISTS research_purchases (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  city_list_id BIGINT NOT NULL REFERENCES city_lists(id),
  stripe_session_id TEXT NOT NULL UNIQUE,  -- second-line idempotency for Stripe replay
  stripe_payment_id TEXT,
  amount_cents INTEGER NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'in_research', 'delivered', 'cancelled')),
  digest_subscription_until TIMESTAMPTZ NOT NULL,  -- purchased_at + 90 days
  purchased_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  delivered_at TIMESTAMPTZ,
  UNIQUE(user_id, city_list_id)
);

-- Note: the UNIQUE(user_id, city_list_id) constraint already creates a btree
-- index covering both columns, so no separate index is needed for that lookup.

-- ============================================================
-- Step 3: digest_subscriptions table (per-customer 90-day clock + unsubscribe token)
--
-- city is intentionally denormalized from research_purchase_id → city_list_id →
-- city_lists.city: the cron job batches by city and fetching the join on every
-- send is unnecessary overhead.
--
-- DENORMALIZATION SAFETY: city_lists.city is the URL slug and MUST be treated
-- as immutable post-creation. Step 3a below installs an UPDATE trigger that
-- rejects any change to city_lists.city. If a city slug ever needs to change
-- (typo fix, rename), the migration is: insert new row with new slug, update
-- digest_subscriptions.city for affected rows in same transaction, then mark
-- old row inactive. Trigger ensures the unsafe path (raw UPDATE) cannot
-- silently desync digest sends from research records.
-- ============================================================
CREATE TABLE IF NOT EXISTS digest_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  research_purchase_id BIGINT NOT NULL REFERENCES research_purchases(id),
  city TEXT NOT NULL,
  unsubscribe_token TEXT NOT NULL UNIQUE,  -- random URL-safe token, 32+ bytes
  active BOOLEAN DEFAULT true NOT NULL,
  unsubscribed_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_digest_subscriptions_city_active
  ON digest_subscriptions(city) WHERE active = true;

-- Cron query pattern (illustrative):
-- SELECT id, research_purchase_id, city, unsubscribe_token
-- FROM digest_subscriptions
-- WHERE active = true
--   AND city = $1
--   AND (last_sent_at IS NULL OR last_sent_at < NOW() - INTERVAL '6 days')
--   AND created_at < NOW() - INTERVAL '1 hour';  -- avoid sending to brand-new subs

-- ============================================================
-- Step 3a: city_lists.city immutability trigger
-- Prevents UPDATE city_lists SET city='xx' from desyncing digest_subscriptions.
-- ============================================================
CREATE OR REPLACE FUNCTION reject_city_lists_city_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.city IS DISTINCT FROM NEW.city THEN
    RAISE EXCEPTION 'city_lists.city is immutable (would desync digest_subscriptions); use insert-and-deactivate pattern instead';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS city_lists_immutable_city ON city_lists;
CREATE TRIGGER city_lists_immutable_city
  BEFORE UPDATE ON city_lists
  FOR EACH ROW
  EXECUTE FUNCTION reject_city_lists_city_update();

-- ============================================================
-- Step 4: delivery_events table (Resend bounce/complaint logging + admin audit)
-- ============================================================
CREATE TABLE IF NOT EXISTS delivery_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),  -- nullable: bounce events for unknown emails still log
  email TEXT NOT NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('sent', 'delivered', 'bounced', 'complained', 'unsubscribed', 'admin_action')),
  resend_message_id TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_delivery_events_user_id
  ON delivery_events(user_id);

-- ============================================================
-- Step 5: users.email_status column for bounce-aware send logic
-- ============================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_status TEXT
  DEFAULT 'unknown'
  CHECK (email_status IN ('unknown', 'verified', 'bounced', 'complained'));

-- ============================================================
-- Step 6: RLS — research_purchases (service role only, mirrors list_purchases)
-- ============================================================
ALTER TABLE research_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "research_purchases_service_role_all" ON research_purchases;
CREATE POLICY "research_purchases_service_role_all" ON research_purchases
  FOR ALL
  TO service_role
  USING (true);

-- ============================================================
-- Step 7: RLS — digest_subscriptions (service role only)
-- ============================================================
ALTER TABLE digest_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "digest_subscriptions_service_role_all" ON digest_subscriptions;
CREATE POLICY "digest_subscriptions_service_role_all" ON digest_subscriptions
  FOR ALL
  TO service_role
  USING (true);

-- ============================================================
-- Step 8: RLS — delivery_events (service role only; no anon access)
-- ============================================================
ALTER TABLE delivery_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_events_service_role_all" ON delivery_events;
CREATE POLICY "delivery_events_service_role_all" ON delivery_events
  FOR ALL
  TO service_role
  USING (true);
