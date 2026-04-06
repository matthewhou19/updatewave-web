/**
 * publish_csv.ts — Import qualified leads from CSV into Supabase projects table.
 *
 * Usage:
 *   npx tsx scripts/publish_csv.ts <csv_path> [--dry-run]
 *
 * Reads .env.local for Supabase credentials.
 * Inserts as status='published' with published_at=now().
 * Deduplicates by (address, city) — skips rows that already exist.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ---------------------------------------------------------------------------
// Load .env.local (minimal parser, no external deps)
// ---------------------------------------------------------------------------
function loadEnvLocal(): void {
  const envPath = resolve(__dirname, '..', '.env.local')
  let content: string
  try {
    content = readFileSync(envPath, 'utf-8')
  } catch {
    console.error('ERROR: .env.local not found at', envPath)
    process.exit(1)
  }
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

// ---------------------------------------------------------------------------
// CSV parser (handles quoted fields with commas)
// ---------------------------------------------------------------------------
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"'
        i++ // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current.trim())
  return fields
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []

  const headers = parseCSVLine(lines[0])
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? ''
    }
    rows.push(row)
  }
  return rows
}

// ---------------------------------------------------------------------------
// Map CSV row → projects table insert
// ---------------------------------------------------------------------------
interface ProjectInsert {
  city: string
  address: string
  project_type: string | null
  architect_name: string | null
  architect_firm: string | null
  architect_website: string | null
  filing_date: string | null
  source_url: string | null
  status: string
  published_at: string
}

function mapRow(row: Record<string, string>): ProjectInsert {
  return {
    city: row.city || 'Unknown',
    address: row.address || '',
    project_type: row.project_category || null,
    architect_name: row.applicant || null,
    architect_firm: row.applicant_firm || null,
    architect_website: row.architect_website || null,
    filing_date: row.filed_date || null,
    source_url: row.source_url || null,
    status: 'published',
    published_at: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  loadEnvLocal()

  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const csvPath = args.find((a) => !a.startsWith('--'))

  if (!csvPath) {
    console.error('Usage: npx tsx scripts/publish_csv.ts <csv_path> [--dry-run]')
    process.exit(1)
  }

  // Read CSV
  const absolutePath = resolve(csvPath)
  let csvContent: string
  try {
    csvContent = readFileSync(absolutePath, 'utf-8')
  } catch {
    console.error('ERROR: Cannot read file:', absolutePath)
    process.exit(1)
  }

  const rows = parseCSV(csvContent)
  console.log(`Parsed ${rows.length} rows from ${absolutePath}\n`)

  if (rows.length === 0) {
    console.log('Nothing to publish.')
    return
  }

  // Connect to Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Fetch existing projects for dedup (by address + city)
  const { data: existing, error: fetchError } = await supabase
    .from('projects')
    .select('address, city')

  if (fetchError) {
    console.error('ERROR: Failed to fetch existing projects:', fetchError.message)
    process.exit(1)
  }

  const existingKeys = new Set(
    (existing ?? []).map((p: { address: string; city: string }) =>
      `${p.address.toUpperCase()}|${p.city.toUpperCase()}`
    )
  )

  // Map and filter
  const toInsert: ProjectInsert[] = []
  const skipped: string[] = []

  for (const row of rows) {
    const key = `${(row.address || '').toUpperCase()}|${(row.city || '').toUpperCase()}`
    if (existingKeys.has(key)) {
      skipped.push(row.address)
      continue
    }
    toInsert.push(mapRow(row))
  }

  // Report
  console.log(`  New:     ${toInsert.length}`)
  console.log(`  Skipped: ${skipped.length} (already in Supabase)`)
  if (skipped.length > 0) {
    console.log(`           ${skipped.join(', ')}`)
  }
  console.log()

  if (toInsert.length === 0) {
    console.log('Nothing new to insert.')
    return
  }

  // Preview
  for (const p of toInsert) {
    console.log(`  → ${p.address}, ${p.city} | ${p.project_type} | ${p.architect_firm ?? 'no firm'}`)
  }
  console.log()

  if (dryRun) {
    console.log('[DRY RUN] No data written.')
    return
  }

  // Insert
  const { data: inserted, error: insertError } = await supabase
    .from('projects')
    .insert(toInsert)
    .select('id, address, city')

  if (insertError) {
    console.error('ERROR: Insert failed:', insertError.message)
    process.exit(1)
  }

  console.log(`Published ${inserted?.length ?? 0} projects:`)
  for (const p of inserted ?? []) {
    console.log(`  id=${p.id}  ${p.address}, ${p.city}`)
  }
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
