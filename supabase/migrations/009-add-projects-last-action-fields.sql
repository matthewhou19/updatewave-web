-- 009: Track the most recent planning ACTION on a project.
--
-- Design-review leads (e.g. Saratoga Planning Commission) are often filed years
-- before they're decided and get continued across many hearings. filing_date is
-- the ORIGINAL submittal; these two columns capture CURRENT activity, so a lead
-- reads as fresh (and can be sorted by recency) instead of looking stale:
--   last_action_date    -- date of the most recent planning action / hearing
--   last_action_summary -- what that action did, from the minutes, e.g.
--                          "Continued to a date certain of July 8, 2026"
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_action_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_action_summary TEXT;
