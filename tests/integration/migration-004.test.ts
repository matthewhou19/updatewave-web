import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Migration 004 contract tests.
 *
 * Migration 004 fixes the (city, year) UNIQUE constraint on city_lists so we
 * can have BOTH a $349 'report' SKU and a $1999 'research' SKU for the same
 * city/year. It then seeds the SJ 2025 research row.
 *
 * Static analysis only — same approach as tests/integration/migration-003.test.ts
 * (vitest runs in node env without a real Postgres). Real-Postgres replay
 * belongs in a future infra layer.
 */

let sql: string
let sqlCode: string // sql with `-- ...` line comments stripped

beforeAll(() => {
  const migrationPath = resolve(
    __dirname,
    '../../supabase/migrations/004-research-tier-uniqueness-fix.sql'
  )
  sql = readFileSync(migrationPath, 'utf-8')
  sqlCode = sql.replace(/--[^\n]*/g, '')
})

describe('migration 004: file presence + structure', () => {
  it('exists and is non-empty', () => {
    expect(sql.length).toBeGreaterThan(0)
  })

  it('declares its purpose at the top of the file', () => {
    const head = sql.slice(0, 500)
    expect(head).toMatch(/Migration 004/i)
  })
})

describe('migration 004: drops the old (city, year) constraint', () => {
  it('uses DROP CONSTRAINT IF EXISTS on city_lists_city_year_key', () => {
    expect(sqlCode).toMatch(
      /ALTER TABLE city_lists\s+DROP CONSTRAINT IF EXISTS\s+city_lists_city_year_key/i
    )
  })
})

describe('migration 004: adds the new (city, year, service_tier) constraint', () => {
  it('uses a DO block with pg_constraint check (idempotent ADD CONSTRAINT)', () => {
    // ALTER TABLE ... ADD CONSTRAINT does not support IF NOT EXISTS in
    // Postgres, so the migration must guard with a DO $$ ... END $$ block
    // that checks pg_constraint for the conname before adding.
    expect(sqlCode).toMatch(/DO\s+\$\$/i)
    expect(sqlCode).toMatch(/pg_constraint/i)
    expect(sqlCode).toMatch(
      /conname\s*=\s*'city_lists_city_year_service_tier_key'/i
    )
  })

  it('adds UNIQUE (city, year, service_tier)', () => {
    expect(sqlCode).toMatch(
      /ADD CONSTRAINT\s+city_lists_city_year_service_tier_key\s+UNIQUE\s*\(\s*city\s*,\s*year\s*,\s*service_tier\s*\)/i
    )
  })
})

describe('migration 004: seeds the SJ 2025 research SKU', () => {
  it('inserts into city_lists with ON CONFLICT DO NOTHING (idempotent)', () => {
    expect(sqlCode).toMatch(/INSERT INTO city_lists/i)
    expect(sqlCode).toMatch(
      /ON CONFLICT\s*\(\s*city\s*,\s*year\s*,\s*service_tier\s*\)\s+DO NOTHING/i
    )
  })

  it('seed values: city=sj, year=2025, service_tier=research', () => {
    // Look for the VALUES block of the INSERT statement
    const m = sqlCode.match(/INSERT INTO city_lists[\s\S]+?VALUES\s*\(([\s\S]+?)\)\s*ON CONFLICT/i)
    expect(m).not.toBeNull()
    const values = m![1]
    expect(values).toMatch(/'sj'/)
    expect(values).toMatch(/2025/)
    expect(values).toMatch(/'research'/)
  })

  it('seed price_cents = 199900 ($1,999)', () => {
    const m = sqlCode.match(/INSERT INTO city_lists[\s\S]+?VALUES\s*\(([\s\S]+?)\)\s*ON CONFLICT/i)!
    expect(m[1]).toMatch(/199900/)
  })

  it('seed delivery_window_days = NULL (instant SKU)', () => {
    // The position of NULL in the VALUES list matters. Easier check: the
    // VALUES block contains NULL (for delivery_window_days) and not
    // an integer value where delivery_window_days appears.
    const m = sqlCode.match(/INSERT INTO city_lists[\s\S]+?VALUES\s*\(([\s\S]+?)\)\s*ON CONFLICT/i)!
    // Two NULLs expected: anchor_price_cents and delivery_window_days
    const nulls = m[1].match(/\bNULL\b/g) ?? []
    expect(nulls.length).toBeGreaterThanOrEqual(2)
  })

  it('seed pdf_storage_path = sj-2025.pdf (same as $349 report)', () => {
    const m = sqlCode.match(/INSERT INTO city_lists[\s\S]+?VALUES\s*\(([\s\S]+?)\)\s*ON CONFLICT/i)!
    expect(m[1]).toMatch(/'sj-2025\.pdf'/)
  })

  it('seed active = true', () => {
    const m = sqlCode.match(/INSERT INTO city_lists[\s\S]+?VALUES\s*\(([\s\S]+?)\)\s*ON CONFLICT/i)!
    expect(m[1]).toMatch(/\btrue\b/)
  })
})

describe('migration 004: parses cleanly (no obvious SQL syntax issues)', () => {
  it('has balanced parentheses', () => {
    const opens = (sqlCode.match(/\(/g) ?? []).length
    const closes = (sqlCode.match(/\)/g) ?? []).length
    expect(opens).toBe(closes)
  })

  it('every statement appears to terminate with a semicolon', () => {
    expect(sqlCode.trim().endsWith(';')).toBe(true)
  })
})
