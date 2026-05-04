-- Migration 003: Email login auth (additive to hash auth)
-- Run this in Supabase SQL Editor against the production project.
--
-- Adds the auth_user_id link from public.users to auth.users, the UNIQUE
-- constraint on users.email (partial, WHERE NOT NULL), and two new tables:
-- identity_fork_alerts and auth_login_events.
--
-- Idempotent: uses IF NOT EXISTS, ON CONFLICT, DROP POLICY IF EXISTS.

-- ============================================================
-- Step 0: Pre-flight duplicate email detection (manual step)
-- ============================================================
-- Before applying Step 2, run this query:
--   SELECT email, count(*) FROM users
--   WHERE email IS NOT NULL
--   GROUP BY email HAVING count(*) > 1;
-- Resolve any duplicates manually (merge or null one) before continuing.

-- ============================================================
-- Step 1: Add auth_user_id column to users
-- ============================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_auth_user_id
  ON users(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- ============================================================
-- Step 2: Partial UNIQUE on users.email WHERE NOT NULL
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_email_not_null
  ON users(email) WHERE email IS NOT NULL;

-- ============================================================
-- Step 3: identity_fork_alerts table (case-(e) detection)
-- ============================================================
CREATE TABLE IF NOT EXISTS identity_fork_alerts (
  id BIGSERIAL PRIMARY KEY,
  user_id_new BIGINT NOT NULL REFERENCES users(id),
  user_id_likely_old BIGINT NOT NULL REFERENCES users(id),
  similarity_signal TEXT NOT NULL CHECK (similarity_signal IN ('same_local_part','same_domain')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_identity_fork_alerts_unreviewed
  ON identity_fork_alerts(created_at DESC) WHERE reviewed_at IS NULL;

ALTER TABLE identity_fork_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "identity_fork_alerts_service_role_all" ON identity_fork_alerts;
CREATE POLICY "identity_fork_alerts_service_role_all" ON identity_fork_alerts
  FOR ALL TO service_role USING (true);

-- ============================================================
-- Step 4: auth_login_events table (activation tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS auth_login_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  auth_user_id UUID,
  event_type TEXT NOT NULL CHECK (event_type IN ('link_requested','link_clicked','callback_succeeded','callback_failed')),
  occurred_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_login_events_user_time
  ON auth_login_events(user_id, occurred_at DESC);

ALTER TABLE auth_login_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_login_events_service_role_all" ON auth_login_events;
CREATE POLICY "auth_login_events_service_role_all" ON auth_login_events
  FOR ALL TO service_role USING (true);
