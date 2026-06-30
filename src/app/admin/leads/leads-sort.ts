/**
 * Pure sort helpers for the admin lead review board.
 *
 * Kept React-free and side-effect-free so the client component stays thin and
 * the ordering rules can be unit-tested directly. `dateField` lets one
 * comparator serve both sections: candidates sort by `created_at` (录入时间),
 * published leads by `published_at` (上线时间).
 */

import type { Project } from '@/lib/types'
import type { Drawing } from '@/lib/drawings'

/** A lead plus its (already signed) drawing URLs, kept together so sorting one
 *  never desyncs them. */
export interface LeadItem {
  project: Project
  drawings: Drawing[]
}

export type SortKey = 'date' | 'address' | 'value'
export type SortDir = 'asc' | 'desc'
export type DateField = 'created_at' | 'published_at'

export interface SortState {
  key: SortKey
  dir: SortDir
}

/**
 * Return a NEW array ordered by `key`/`dir`. Never mutates the input.
 * `dateField` selects which timestamp drives the 'date' key for this section.
 */
export function sortLeadItems(
  items: readonly LeadItem[],
  key: SortKey,
  dir: SortDir,
  dateField: DateField
): LeadItem[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...items].sort((a, b) => sign * compareAsc(a.project, b.project, key, dateField))
}

/**
 * Pick the next sort state when a sort key is clicked: clicking the active key
 * flips direction; clicking a new key selects it with a sensible default
 * direction (addresses A→Z, dates/values high→low / newest-first).
 */
export function pickSort(key: SortKey, current: SortState): SortState {
  if (current.key === key) {
    return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
  }
  return { key, dir: key === 'address' ? 'asc' : 'desc' }
}

function compareAsc(a: Project, b: Project, key: SortKey, dateField: DateField): number {
  switch (key) {
    case 'address':
      return a.address.localeCompare(b.address)
    case 'value':
      return numAsc(a.estimated_value_cents, b.estimated_value_cents)
    case 'date':
    default:
      return toMillis(a[dateField]) - toMillis(b[dateField])
  }
}

function toMillis(iso: string | null): number {
  if (!iso) return 0
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

function numAsc(a: number | null, b: number | null): number {
  return (a ?? -1) - (b ?? -1)
}
