-- UpdateWave Web: Supabase Schema
-- Run this in the Supabase SQL Editor after creating your project.

-- Projects table (pre-permit listings pushed from apollo.db pipeline)
CREATE TABLE projects (
  id BIGSERIAL PRIMARY KEY,
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  project_type TEXT,
  estimated_value_cents BIGINT,
  estimated_value TEXT,          -- display string e.g. "$1.2M"
  architect_name TEXT,
  architect_firm TEXT,
  architect_contact TEXT,        -- phone/email
  architect_website TEXT,
  source_permit_id BIGINT,      -- FK to apollo.db permits.id (for dedup)
  filing_date DATE,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'candidate'
    CHECK (status IN ('candidate', 'published', 'stale', 'archived')),
  reveal_count INTEGER NOT NULL DEFAULT 0,
  reviewed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users table (GCs who receive cold emails with hash URLs)
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  hash TEXT NOT NULL UNIQUE,     -- 43-char token_urlsafe, used in URLs
  name TEXT,
  company TEXT,
  email TEXT,
  city_filter TEXT,              -- preferred city for pre-filtering
  source_campaign TEXT,          -- which email campaign created this user
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ
);

-- Reveals table (payment records, one per user+project)
CREATE TABLE reveals (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  project_id BIGINT NOT NULL REFERENCES projects(id),
  stripe_payment_id TEXT,
  amount_cents INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_id)   -- idempotency: one reveal per user per project
);

-- Project status change log (audit trail)
CREATE TABLE project_status_log (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id),
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for browse page queries
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_city ON projects(city);
CREATE INDEX idx_projects_published ON projects(status, city, filing_date DESC)
  WHERE status = 'published';
CREATE INDEX idx_projects_source_permit ON projects(source_permit_id)
  WHERE source_permit_id IS NOT NULL;

-- Indexes for user lookups
CREATE INDEX idx_users_hash ON users(hash);

-- Indexes for reveals
CREATE INDEX idx_reveals_user ON reveals(user_id);
CREATE INDEX idx_reveals_project ON reveals(project_id);

-- Auto-update updated_at on projects
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Row Level Security (RLS)
-- Projects: read-only for anon, full access for service role
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read published projects"
  ON projects FOR SELECT
  USING (status = 'published');

-- Users: service role only (no client-side access to user table)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- No anon policies = service role key required

-- Reveals: service role only
ALTER TABLE reveals ENABLE ROW LEVEL SECURITY;
-- No anon policies = service role key required

-- Status log: service role only
ALTER TABLE project_status_log ENABLE ROW LEVEL SECURITY;
