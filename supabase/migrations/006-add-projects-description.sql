-- Migration 006: add projects.description column
-- Run this in Supabase SQL Editor against the production project.
--
-- PR #6 ("mask street number for unrevealed cards, show description") added
-- code that references projects.description, but the corresponding ALTER
-- TABLE was applied directly to the prod Supabase instance and never
-- captured as a migration. As a result, fresh local databases (npm run
-- db:reset) crash on /browse with "column projects.description does not
-- exist" until this migration runs.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS description TEXT;
