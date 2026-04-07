-- Migration: Add reveal_count trigger + user soft-delete
-- Run this in Supabase SQL Editor against the production project.
--
-- 1. Replaces manual reveal_count increment in webhook handler with
--    automatic Postgres trigger. Prevents race condition on concurrent webhooks.
-- 2. Adds deleted_at column for user soft-delete. Prevents lost payments when
--    a user is deleted between Stripe checkout and webhook delivery.

-- Step 1: Add soft-delete column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Step 2: Create reveal_count trigger function
CREATE OR REPLACE FUNCTION update_reveal_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE projects SET reveal_count = reveal_count + 1 WHERE id = NEW.project_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE projects SET reveal_count = reveal_count - 1 WHERE id = OLD.project_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger (drop first if exists to make idempotent)
DROP TRIGGER IF EXISTS reveals_update_count ON reveals;
CREATE TRIGGER reveals_update_count
  AFTER INSERT OR DELETE ON reveals
  FOR EACH ROW
  EXECUTE FUNCTION update_reveal_count();

-- Step 4: Reconcile existing reveal_count values with actual reveal counts
-- This ensures reveal_count matches reality after switching to trigger-based approach.
UPDATE projects p
SET reveal_count = (
  SELECT COUNT(*) FROM reveals r WHERE r.project_id = p.id
);
