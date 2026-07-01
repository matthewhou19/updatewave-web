/**
 * Assembles the view model for the /browse cards: picks the free-vs-paid
 * description per reveal state and attaches the flexible reveal manifest
 * (which of {owner contact, architect contact, drawings} this lead has) plus
 * the drawing URLs delivered to revealed leads.
 *
 * Pure and deterministic so it can be unit-tested without Supabase; the page
 * does the fetching and hands the results in.
 */

import { Project } from './types'
import { Drawing } from './drawings'
import { stripOwnerContact } from './owner'

export interface BrowseProject extends Project {
  /** Pre-reveal manifest flags (safe to expose — booleans, never the values). */
  has_owner_contact: boolean
  has_architect_contact: boolean
  has_drawings: boolean
  /** Signed drawing URLs — populated for revealed leads only. */
  drawings: Drawing[]
}

export interface AssembleBrowseInput {
  /** Published projects, already architect-merged (values for revealed ids only). */
  projects: Project[]
  revealedProjectIds: number[]
  /** Published ids that carry architect info (from fetchArchitectPresenceIds). */
  architectPresenceIds: number[]
  /** Published ids that have ≥1 drawing (from fetchDrawingProjectIds). */
  drawingProjectIds: number[]
  /** Signed drawing URLs for revealed ids (from fetchDrawingsForProjects). */
  drawingsByProject: Record<number, Drawing[]>
}

export function assembleBrowseProjects(input: AssembleBrowseInput): BrowseProject[] {
  const revealed = new Set(input.revealedProjectIds)
  const architectPresent = new Set(input.architectPresenceIds)
  const drawingsPresent = new Set(input.drawingProjectIds)

  return input.projects.map((p) => {
    const isRevealed = revealed.has(p.id)
    const { sanitized, hasOwnerContact } = stripOwnerContact(p.description)

    return {
      ...p,
      // Free view gets the owner-stripped description; paid view gets the raw
      // text (owner inline is fine once they've paid).
      description: isRevealed ? p.description : sanitized,
      has_owner_contact: hasOwnerContact,
      has_architect_contact: architectPresent.has(p.id),
      has_drawings: drawingsPresent.has(p.id),
      drawings: isRevealed ? input.drawingsByProject[p.id] ?? [] : [],
    }
  })
}
