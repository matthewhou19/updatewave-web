-- Migration 008: lead-drawings storage bucket (admin lead review)
-- Run this in the Supabase SQL Editor against production (same manual process
-- as migrations 001-007). Applied automatically to the local/CI stack by
-- scripts/db-init.sh.
--
-- A PRIVATE bucket holding optional architectural drawings for pre-permit
-- leads, one folder per project: lead-drawings/{project_id}/<file>. The
-- /admin/leads review page lists a lead's folder and serves short-lived signed
-- download URLs using the service-role key, which bypasses Storage RLS — so no
-- storage policies are needed and anon never gets access.
--
-- Idempotent: ON CONFLICT DO NOTHING.

INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-drawings', 'lead-drawings', false)
ON CONFLICT (id) DO NOTHING;
