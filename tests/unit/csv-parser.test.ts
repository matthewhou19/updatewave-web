import { describe, it, expect } from 'vitest'
import { parseCSVLine, parseCSV, mapRow } from '../../scripts/publish_csv'

describe('parseCSVLine', () => {
  it('parses simple comma-separated values', () => {
    expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c'])
  })

  it('parses quoted fields containing commas', () => {
    expect(parseCSVLine('"hello, world",b,c')).toEqual(['hello, world', 'b', 'c'])
  })

  it('parses escaped quotes (double-quote inside quoted field)', () => {
    expect(parseCSVLine('"say ""hello""",b')).toEqual(['say "hello"', 'b'])
  })

  it('handles empty fields', () => {
    expect(parseCSVLine('a,,c')).toEqual(['a', '', 'c'])
  })

  it('handles single field', () => {
    expect(parseCSVLine('hello')).toEqual(['hello'])
  })

  it('handles empty string', () => {
    expect(parseCSVLine('')).toEqual([''])
  })

  it('trims whitespace from fields', () => {
    expect(parseCSVLine(' a , b , c ')).toEqual(['a', 'b', 'c'])
  })

  it('handles quoted field with no commas inside', () => {
    expect(parseCSVLine('"hello",b')).toEqual(['hello', 'b'])
  })
})

describe('parseCSV', () => {
  it('parses header + data rows', () => {
    const csv = 'name,age\nAlice,30\nBob,25'
    const result = parseCSV(csv)
    expect(result).toEqual([
      { name: 'Alice', age: '30' },
      { name: 'Bob', age: '25' },
    ])
  })

  it('returns empty array for empty content', () => {
    expect(parseCSV('')).toEqual([])
  })

  it('returns empty array for header-only CSV', () => {
    const result = parseCSV('name,age')
    expect(result).toEqual([])
  })

  it('handles missing values (fewer columns than headers)', () => {
    const csv = 'a,b,c\n1'
    const result = parseCSV(csv)
    expect(result[0].a).toBe('1')
    expect(result[0].b).toBe('')  // undefined -> ''
    expect(result[0].c).toBe('')
  })

  it('skips blank lines', () => {
    const csv = 'name\n\nAlice\n\nBob\n'
    const result = parseCSV(csv)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Alice')
    expect(result[1].name).toBe('Bob')
  })
})

describe('mapRow', () => {
  it('maps all CSV columns to database columns', () => {
    const row = {
      city: 'Los Altos',
      address: '123 Main St',
      project_category: 'Design Review',
      applicant: 'Jane Doe',
      applicant_firm: 'Doe Architecture',
      architect_website: 'https://doe.com',
      filed_date: '2026-01-15',
      source_url: 'https://city.gov/permit/123',
    }
    const result = mapRow(row)
    expect(result.city).toBe('Los Altos')
    expect(result.address).toBe('123 Main St')
    expect(result.project_type).toBe('Design Review')
    expect(result.architect_name).toBe('Jane Doe')
    expect(result.architect_firm).toBe('Doe Architecture')
    expect(result.architect_website).toBe('https://doe.com')
    expect(result.filing_date).toBe('2026-01-15')
    expect(result.source_url).toBe('https://city.gov/permit/123')
    expect(result.status).toBe('published')
    expect(result.published_at).toBeTruthy()
  })

  it('defaults city to "Unknown" when missing', () => {
    const row = { address: '123 Main St' } as Record<string, string>
    const result = mapRow(row)
    expect(result.city).toBe('Unknown')
  })

  it('returns null for missing optional fields', () => {
    const row = { city: 'Test', address: '123 Main' } as Record<string, string>
    const result = mapRow(row)
    expect(result.project_type).toBeNull()
    expect(result.architect_name).toBeNull()
    expect(result.architect_firm).toBeNull()
    expect(result.architect_website).toBeNull()
    expect(result.filing_date).toBeNull()
    expect(result.source_url).toBeNull()
  })

  it('sets status to published and published_at to current time', () => {
    const before = new Date().toISOString()
    const result = mapRow({ city: 'Test', address: '123' } as Record<string, string>)
    const after = new Date().toISOString()
    expect(result.status).toBe('published')
    expect(result.published_at >= before).toBe(true)
    expect(result.published_at <= after).toBe(true)
  })
})
