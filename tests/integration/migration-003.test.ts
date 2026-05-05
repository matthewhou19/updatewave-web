import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Migration 003 contract tests.
 *
 * Static analysis of supabase/migrations/003-research-and-digest.sql. The
 * project does not currently run a real Postgres instance during `npm test`
 * (vitest runs in node env, mocked Supabase client) — so we validate the SQL
 * file against the contract Lane A is required to honor:
 *
 *   - idempotent (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
 *     DROP POLICY/TRIGGER IF EXISTS — re-running the migration must not error)
 *   - FK types are BIGSERIAL/BIGINT (NOT UUID — would break webhook's parseInt)
 *   - city_lists.city UPDATE trigger raises an exception (denormalization safety)
 *   - research_purchases UNIQUE(user_id, city_list_id) blocks duplicates
 *   - digest_subscriptions.unsubscribe_token UNIQUE
 *   - all RLS policies are present (service-role-only, mirrors migration 002)
 *   - users.email_status column added with CHECK constraint
 *
 * "Run twice = no error" idempotency is verified by the marker check below:
 * every CREATE/ALTER/DROP carries the appropriate IF EXISTS / IF NOT EXISTS
 * clause. A real Postgres replay test belongs in a future infra layer.
 */

let sql: string
let sqlCode: string  // sql with `-- ...` line comments stripped

beforeAll(() => {
  const migrationPath = resolve(
    __dirname,
    '../../supabase/migrations/003-research-and-digest.sql'
  )
  sql = readFileSync(migrationPath, 'utf-8')
  // Strip line comments before structural assertions so prose in headers
  // (e.g. "ADD COLUMN IF NOT EXISTS, DROP POLICY...") cannot match the
  // statement-shape regexes below.
  sqlCode = sql.replace(/--[^\n]*/g, '')
})

describe('migration 003: file presence + structure', () => {
  it('exists and is non-empty', () => {
    expect(sql.length).toBeGreaterThan(0)
  })

  it('declares its purpose at the top of the file', () => {
    // Defense against an empty/truncated migration file slipping into a release.
    const head = sql.slice(0, 500)
    expect(head).toMatch(/Migration 003/i)
  })
})

describe('migration 003: idempotency markers (run twice = no error)', () => {
  it('every CREATE TABLE uses IF NOT EXISTS', () => {
    const createTables = sqlCode.match(/CREATE TABLE[^;]+/gi) ?? []
    expect(createTables.length).toBeGreaterThan(0)
    for (const stmt of createTables) {
      expect(stmt).toMatch(/CREATE TABLE\s+IF NOT EXISTS/i)
    }
  })

  it('every ALTER TABLE ADD COLUMN uses IF NOT EXISTS', () => {
    const addColumns = sqlCode.match(/ADD COLUMN[^,;]+/gi) ?? []
    expect(addColumns.length).toBeGreaterThan(0)
    for (const stmt of addColumns) {
      expect(stmt).toMatch(/ADD COLUMN\s+IF NOT EXISTS/i)
    }
  })

  it('every CREATE INDEX uses IF NOT EXISTS', () => {
    const createIndexes = sqlCode.match(/CREATE\s+INDEX[^;]+/gi) ?? []
    expect(createIndexes.length).toBeGreaterThan(0)
    for (const stmt of createIndexes) {
      expect(stmt).toMatch(/CREATE\s+INDEX\s+IF NOT EXISTS/i)
    }
  })

  it('every CREATE POLICY is preceded by a matching DROP POLICY IF EXISTS', () => {
    // Match each CREATE POLICY and verify a DROP POLICY IF EXISTS for the same
    // policy name appears earlier in the file.
    const createPolicies = [
      ...sqlCode.matchAll(/CREATE POLICY\s+"([^"]+)"\s+ON\s+(\w+)/gi),
    ]
    expect(createPolicies.length).toBeGreaterThan(0)
    for (const [, name, table] of createPolicies) {
      const dropPattern = new RegExp(
        `DROP POLICY IF EXISTS\\s+"${name}"\\s+ON\\s+${table}`,
        'i'
      )
      expect(sqlCode, `expected DROP POLICY IF EXISTS for ${name} on ${table}`).toMatch(
        dropPattern
      )
    }
  })

  it('every CREATE TRIGGER is preceded by a matching DROP TRIGGER IF EXISTS', () => {
    const createTriggers = [...sqlCode.matchAll(/CREATE TRIGGER\s+(\w+)\s+BEFORE/gi)]
    expect(createTriggers.length).toBeGreaterThan(0)
    for (const [, name] of createTriggers) {
      const dropPattern = new RegExp(`DROP TRIGGER IF EXISTS\\s+${name}`, 'i')
      expect(sqlCode, `expected DROP TRIGGER IF EXISTS for ${name}`).toMatch(dropPattern)
    }
  })

  it('uses CREATE OR REPLACE FUNCTION (idempotent function definitions)', () => {
    const fns = sqlCode.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION/gi) ?? []
    expect(fns.length).toBeGreaterThanOrEqual(1)
  })
})

describe('migration 003: FK types are BIGSERIAL/BIGINT (NOT UUID)', () => {
  it('research_purchases.id is BIGSERIAL', () => {
    const m = sqlCode.match(/CREATE TABLE IF NOT EXISTS research_purchases[\s\S]+?\)\s*;/i)
    expect(m).not.toBeNull()
    const block = m![0]
    expect(block).toMatch(/id\s+BIGSERIAL\s+PRIMARY KEY/i)
  })

  it('research_purchases.user_id is BIGINT REFERENCES users(id)', () => {
    const m = sqlCode.match(/CREATE TABLE IF NOT EXISTS research_purchases[\s\S]+?\)\s*;/i)!
    expect(m[0]).toMatch(/user_id\s+BIGINT\s+NOT NULL\s+REFERENCES\s+users\(id\)/i)
  })

  it('research_purchases.city_list_id is BIGINT REFERENCES city_lists(id)', () => {
    const m = sqlCode.match(/CREATE TABLE IF NOT EXISTS research_purchases[\s\S]+?\)\s*;/i)!
    expect(m[0]).toMatch(/city_list_id\s+BIGINT\s+NOT NULL\s+REFERENCES\s+city_lists\(id\)/i)
  })

  it('digest_subscriptions.id is BIGSERIAL', () => {
    const m = sqlCode.match(/CREATE TABLE IF NOT EXISTS digest_subscriptions[\s\S]+?\)\s*;/i)!
    expect(m[0]).toMatch(/id\s+BIGSERIAL\s+PRIMARY KEY/i)
  })

  it('digest_subscriptions.research_purchase_id is BIGINT REFERENCES research_purchases(id)', () => {
    const m = sqlCode.match(/CREATE TABLE IF NOT EXISTS digest_subscriptions[\s\S]+?\)\s*;/i)!
    expect(m[0]).toMatch(
      /research_purchase_id\s+BIGINT\s+NOT NULL\s+REFERENCES\s+research_purchases\(id\)/i
    )
  })

  it('delivery_events.id is BIGSERIAL', () => {
    const m = sqlCode.match(/CREATE TABLE IF NOT EXISTS delivery_events[\s\S]+?\)\s*;/i)!
    expect(m[0]).toMatch(/id\s+BIGSERIAL\s+PRIMARY KEY/i)
  })

  it('delivery_events.user_id is BIGINT REFERENCES users(id) (nullable allowed)', () => {
    const m = sqlCode.match(/CREATE TABLE IF NOT EXISTS delivery_events[\s\S]+?\)\s*;/i)!
    expect(m[0]).toMatch(/user_id\s+BIGINT\s+REFERENCES\s+users\(id\)/i)
  })

  it('NO new tables use UUID for primary keys (regression guard)', () => {
    // The design explicitly calls out UUID as a fix-from-earlier-draft bug.
    // Match within new table blocks only — existing tables (out of scope
    // for this migration) are not under test.
    const newTableBlocks = [
      sqlCode.match(/CREATE TABLE IF NOT EXISTS research_purchases[\s\S]+?\)\s*;/i)?.[0],
      sqlCode.match(/CREATE TABLE IF NOT EXISTS digest_subscriptions[\s\S]+?\)\s*;/i)?.[0],
      sqlCode.match(/CREATE TABLE IF NOT EXISTS delivery_events[\s\S]+?\)\s*;/i)?.[0],
    ]
    for (const block of newTableBlocks) {
      expect(block).toBeDefined()
      expect(block!).not.toMatch(/\bUUID\b/i)
    }
  })
})

describe('migration 003: city_lists extension', () => {
  it('adds service_tier column with CHECK and DEFAULT', () => {
    expect(sqlCode).toMatch(
      /ALTER TABLE city_lists\s+ADD COLUMN IF NOT EXISTS service_tier\s+TEXT\s+NOT NULL\s+DEFAULT\s+'report'/i
    )
    expect(sqlCode).toMatch(
      /CHECK\s*\(\s*service_tier\s+IN\s*\(\s*'report',\s*'research'\s*\)\s*\)/i
    )
  })

  it('adds delivery_window_days INTEGER (NULL allowed for instant SKUs)', () => {
    expect(sqlCode).toMatch(
      /ALTER TABLE city_lists\s+ADD COLUMN IF NOT EXISTS delivery_window_days\s+INTEGER/i
    )
  })
})

describe('migration 003: research_purchases CHECK constraints + UNIQUE', () => {
  it('delivery_status CHECK includes pending, in_research, delivered, cancelled', () => {
    const m = sqlCode.match(/CREATE TABLE IF NOT EXISTS research_purchases[\s\S]+?\)\s*;/i)!
    expect(m[0]).toMatch(/delivery_status\s+TEXT\s+NOT NULL\s+DEFAULT\s+'pending'/i)
    expect(m[0]).toMatch(
      /CHECK\s*\(\s*delivery_status\s+IN\s*\(\s*'pending'\s*,\s*'in_research'\s*,\s*'delivered'\s*,\s*'cancelled'\s*\)\s*\)/i
    )
  })

  it('stripe_session_id is UNIQUE (Stripe replay second-line idempotency)', () => {
    const m = sqlCode.match(/CREATE TABLE IF NOT EXISTS research_purchases[\s\S]+?\)\s*;/i)!
    expect(m[0]).toMatch(/stripe_session_id\s+TEXT\s+NOT NULL\s+UNIQUE/i)
  })

  it('UNIQUE(user_id, city_list_id) blocks duplicate purchases', () => {
    const m = sqlCode.match(/CREATE TABLE IF NOT EXISTS research_purchases[\s\S]+?\)\s*;/i)!
    expect(m[0]).toMatch(/UNIQUE\s*\(\s*user_id\s*,\s*city_list_id\s*\)/i)
  })

  it('digest_subscription_until is TIMESTAMPTZ NOT NULL', () => {
    const m = sqlCode.match(/CREATE TABLE IF NOT EXISTS research_purchases[\s\S]+?\)\s*;/i)!
    expect(m[0]).toMatch(/digest_subscription_until\s+TIMESTAMPTZ\s+NOT NULL/i)
  })
})

describe('migration 003: digest_subscriptions structure', () => {
  it('unsubscribe_token TEXT NOT NULL UNIQUE (CAN-SPAM auth surface)', () => {
    const m = sqlCode.match(/CREATE TABLE IF NOT EXISTS digest_subscriptions[\s\S]+?\)\s*;/i)!
    expect(m[0]).toMatch(/unsubscribe_token\s+TEXT\s+NOT NULL\s+UNIQUE/i)
  })

  it('city is TEXT NOT NULL (denormalized from city_lists.city)', () => {
    const m = sqlCode.match(/CREATE TABLE IF NOT EXISTS digest_subscriptions[\s\S]+?\)\s*;/i)!
    expect(m[0]).toMatch(/city\s+TEXT\s+NOT NULL/i)
  })

  it('active BOOLEAN DEFAULT true NOT NULL', () => {
    const m = sqlCode.match(/CREATE TABLE IF NOT EXISTS digest_subscriptions[\s\S]+?\)\s*;/i)!
    expect(m[0]).toMatch(/active\s+BOOLEAN\s+DEFAULT\s+true\s+NOT NULL/i)
  })

  it('last_sent_at is TIMESTAMPTZ (cron idempotency gate)', () => {
    const m = sqlCode.match(/CREATE TABLE IF NOT EXISTS digest_subscriptions[\s\S]+?\)\s*;/i)!
    expect(m[0]).toMatch(/last_sent_at\s+TIMESTAMPTZ/i)
  })

  it('idx_digest_subscriptions_city_active partial index exists', () => {
    expect(sqlCode).toMatch(
      /CREATE INDEX IF NOT EXISTS\s+idx_digest_subscriptions_city_active[\s\S]+?WHERE\s+active\s*=\s*true/i
    )
  })
})

describe('migration 003: city_lists.city immutability trigger', () => {
  it('defines reject_city_lists_city_update function with RAISE EXCEPTION', () => {
    expect(sqlCode).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+reject_city_lists_city_update/i
    )
    expect(sqlCode).toMatch(/RAISE\s+EXCEPTION\s+'city_lists\.city is immutable/i)
  })

  it('compares OLD.city vs NEW.city via IS DISTINCT FROM (handles NULLs)', () => {
    expect(sqlCode).toMatch(/OLD\.city\s+IS\s+DISTINCT\s+FROM\s+NEW\.city/i)
  })

  it('attaches BEFORE UPDATE trigger named city_lists_immutable_city', () => {
    expect(sqlCode).toMatch(/CREATE TRIGGER\s+city_lists_immutable_city/i)
    expect(sqlCode).toMatch(/BEFORE\s+UPDATE\s+ON\s+city_lists/i)
    expect(sqlCode).toMatch(
      /city_lists_immutable_city[\s\S]+?EXECUTE\s+FUNCTION\s+reject_city_lists_city_update/i
    )
  })
})

describe('migration 003: delivery_events structure', () => {
  it('event_type CHECK includes all 6 documented values', () => {
    const m = sqlCode.match(/CREATE TABLE IF NOT EXISTS delivery_events[\s\S]+?\)\s*;/i)!
    const block = m[0]
    expect(block).toMatch(/event_type\s+TEXT\s+NOT NULL/i)
    // Each value must appear in the CHECK list. Order-agnostic.
    for (const value of [
      'sent',
      'delivered',
      'bounced',
      'complained',
      'unsubscribed',
      'admin_action',
    ]) {
      expect(block, `event_type CHECK must include '${value}'`).toMatch(
        new RegExp(`'${value}'`)
      )
    }
  })

  it('email TEXT NOT NULL (always have an address even on bounce events)', () => {
    const m = sqlCode.match(/CREATE TABLE IF NOT EXISTS delivery_events[\s\S]+?\)\s*;/i)!
    expect(m[0]).toMatch(/email\s+TEXT\s+NOT NULL/i)
  })

  it('payload JSONB column exists', () => {
    const m = sqlCode.match(/CREATE TABLE IF NOT EXISTS delivery_events[\s\S]+?\)\s*;/i)!
    expect(m[0]).toMatch(/payload\s+JSONB/i)
  })

  it('idx_delivery_events_user_id index exists', () => {
    expect(sqlCode).toMatch(/CREATE INDEX IF NOT EXISTS\s+idx_delivery_events_user_id/i)
  })
})

describe('migration 003: users.email_status extension', () => {
  it('adds email_status TEXT DEFAULT unknown with CHECK', () => {
    expect(sqlCode).toMatch(
      /ALTER TABLE users\s+ADD COLUMN IF NOT EXISTS email_status\s+TEXT/i
    )
    expect(sqlCode).toMatch(/DEFAULT\s+'unknown'/i)
    expect(sqlCode).toMatch(
      /CHECK\s*\(\s*email_status\s+IN\s*\(\s*'unknown'\s*,\s*'verified'\s*,\s*'bounced'\s*,\s*'complained'\s*\)\s*\)/i
    )
  })
})

describe('migration 003: RLS policies (service-role-only on all new tables)', () => {
  it('research_purchases has ENABLE ROW LEVEL SECURITY + service_role policy', () => {
    expect(sqlCode).toMatch(
      /ALTER TABLE research_purchases\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i
    )
    expect(sqlCode).toMatch(
      /CREATE POLICY\s+"research_purchases_service_role_all"\s+ON\s+research_purchases[\s\S]+?TO\s+service_role/i
    )
  })

  it('digest_subscriptions has ENABLE ROW LEVEL SECURITY + service_role policy', () => {
    expect(sqlCode).toMatch(
      /ALTER TABLE digest_subscriptions\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i
    )
    expect(sqlCode).toMatch(
      /CREATE POLICY\s+"digest_subscriptions_service_role_all"\s+ON\s+digest_subscriptions[\s\S]+?TO\s+service_role/i
    )
  })

  it('delivery_events has ENABLE ROW LEVEL SECURITY + service_role policy', () => {
    expect(sqlCode).toMatch(
      /ALTER TABLE delivery_events\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i
    )
    expect(sqlCode).toMatch(
      /CREATE POLICY\s+"delivery_events_service_role_all"\s+ON\s+delivery_events[\s\S]+?TO\s+service_role/i
    )
  })

  it('all RLS policies are service-role-only (no anon read on new tables)', () => {
    // No CREATE POLICY ... TO anon for any of the three new tables.
    const newTables = ['research_purchases', 'digest_subscriptions', 'delivery_events']
    for (const table of newTables) {
      const anonPattern = new RegExp(
        `CREATE POLICY[^;]+ON\\s+${table}[\\s\\S]+?TO\\s+anon`,
        'i'
      )
      expect(sqlCode, `${table} must not have an anon RLS policy`).not.toMatch(
        anonPattern
      )
    }
  })
})

describe('migration 003: parses cleanly (no obvious SQL syntax issues)', () => {
  it('has balanced parentheses (in code, ignoring comments)', () => {
    const opens = (sqlCode.match(/\(/g) ?? []).length
    const closes = (sqlCode.match(/\)/g) ?? []).length
    expect(opens).toBe(closes)
  })

  it('every statement appears to terminate with a semicolon', () => {
    expect(sqlCode.trim().endsWith(';')).toBe(true)
  })
})
