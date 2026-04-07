'use client'

import { useEffect, useRef, useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Project } from '@/lib/types'
import { matchesValueRange, formatProjectType } from '@/lib/utils'
import ProjectCard from './ProjectCard'

interface ProjectListProps {
  projects: Project[]
  revealedProjectIds: number[]
  hash?: string
}

interface Filters {
  cities: string[]
  projectTypes: string[]
  valueRange: string
}

const VALUE_RANGES = [
  { label: 'Any value', value: 'any' },
  { label: 'Under $500K', value: 'under500k' },
  { label: '$500K – $1M', value: '500k-1m' },
  { label: '$1M – $5M', value: '1m-5m' },
  { label: 'Over $5M', value: 'over5m' },
]

const STORAGE_KEY = 'uw_filters'

function loadFilters(): Filters {
  if (typeof window === 'undefined') return { cities: [], projectTypes: [], valueRange: 'any' }
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored) as Filters
  } catch {
    // ignore parse errors
  }
  return { cities: [], projectTypes: [], valueRange: 'any' }
}

// matchesValueRange extracted to @/lib/utils for testability and reuse.
// Re-export for backwards compatibility.
export { matchesValueRange } from '@/lib/utils'

function ProjectListInner({ projects, revealedProjectIds, hash }: ProjectListProps) {
  const searchParams = useSearchParams()
  const justRevealedId = searchParams.get('revealed') ? parseInt(searchParams.get('revealed')!, 10) : null
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [filters, setFilters] = useState<Filters>({ cities: [], projectTypes: [], valueRange: 'any' })
  const filtersLoaded = useRef(false)

  // Load filters from localStorage after hydration (can't read localStorage during SSR)
  useEffect(() => {
    if (!filtersLoaded.current) {
      filtersLoaded.current = true
      const stored = loadFilters()
      if (stored.cities.length > 0 || stored.projectTypes.length > 0 || stored.valueRange !== 'any') {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage sync requires post-hydration setState
        setFilters(stored)
      }
    }
  }, [])

  useEffect(() => {
    if (!filtersLoaded.current) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
    } catch {
      // ignore storage errors
    }
  }, [filters])

  const allCities = useMemo(
    () => [...new Set(projects.map((p) => p.city).filter(Boolean))].sort(),
    [projects]
  )

  const allProjectTypes = useMemo(
    () => [...new Set(projects.map((p) => p.project_type).filter((t): t is string => Boolean(t)))].sort(),
    [projects]
  )

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (filters.cities.length > 0 && !filters.cities.includes(p.city)) return false
      if (filters.projectTypes.length > 0 && (!p.project_type || !filters.projectTypes.includes(p.project_type))) return false
      if (!matchesValueRange(p.estimated_value_cents, filters.valueRange)) return false
      return true
    })
  }, [projects, filters])

  function toggleCity(city: string) {
    setFilters((prev) => ({
      ...prev,
      cities: prev.cities.includes(city)
        ? prev.cities.filter((c) => c !== city)
        : [...prev.cities, city],
    }))
  }

  function toggleProjectType(type: string) {
    setFilters((prev) => ({
      ...prev,
      projectTypes: prev.projectTypes.includes(type)
        ? prev.projectTypes.filter((t) => t !== type)
        : [...prev.projectTypes, type],
    }))
  }

  function clearFilters() {
    setFilters({ cities: [], projectTypes: [], valueRange: 'any' })
  }

  const hasActiveFilters = filters.cities.length > 0 || filters.projectTypes.length > 0 || filters.valueRange !== 'any'
  const revealedSet = new Set(revealedProjectIds)

  const filterPanel = (
    <div className="space-y-6">
      {allCities.length > 0 && (
        <fieldset>
          <legend className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide mb-2">
            City
          </legend>
          <div className="space-y-1">
            {allCities.map((city) => (
              <label key={city} className="flex items-center gap-2 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={filters.cities.includes(city)}
                  onChange={() => toggleCity(city)}
                  className="accent-[#2563eb] w-4 h-4"
                />
                <span className="text-sm text-[#111827]">{city}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {allProjectTypes.length > 0 && (
        <fieldset>
          <legend className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide mb-2">
            Project Type
          </legend>
          <div className="space-y-1">
            {allProjectTypes.map((type) => (
              <label key={type} className="flex items-center gap-2 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={filters.projectTypes.includes(type)}
                  onChange={() => toggleProjectType(type)}
                  className="accent-[#2563eb] w-4 h-4"
                />
                <span className="text-sm text-[#111827]">{formatProjectType(type)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div>
        <label className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide mb-2 block">
          Estimated Value
        </label>
        <select
          value={filters.valueRange}
          onChange={(e) => setFilters((prev) => ({ ...prev, valueRange: e.target.value }))}
          className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
        >
          {VALUE_RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="text-sm text-[#2563eb] hover:text-[#1d4ed8]"
        >
          Clear all filters
        </button>
      )}
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Mobile filter toggle */}
      <div className="md:hidden mb-4">
        <button
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          className="w-full text-sm font-medium text-[#111827] bg-white border border-gray-200 rounded-md px-4 py-2.5 flex items-center justify-between"
        >
          <span>Filters {hasActiveFilters ? `(${filters.cities.length + filters.projectTypes.length + (filters.valueRange !== 'any' ? 1 : 0)})` : ''}</span>
          <span>{showMobileFilters ? '▲' : '▼'}</span>
        </button>
        {showMobileFilters && (
          <div className="mt-2 bg-white border border-gray-200 rounded-md p-4">
            {filterPanel}
          </div>
        )}
      </div>

      <div className="flex gap-6">
        {/* Desktop sidebar */}
        <aside className="hidden md:block w-[240px] flex-shrink-0">
          {filterPanel}
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <p className="text-sm text-[#6b7280] mb-4">
            Showing {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
          </p>

          {filteredProjects.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[#6b7280] mb-1">No projects match your filters.</p>
              <p className="text-sm text-[#71717a]">Try adjusting your city or project type.</p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-4 px-4 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-medium rounded-md transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isRevealed={revealedSet.has(project.id)}
                  hash={hash}
                  justRevealed={justRevealedId === project.id}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default function ProjectList(props: ProjectListProps) {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-6"><p className="text-sm text-[#6b7280]">Loading...</p></div>}>
      <ProjectListInner {...props} />
    </Suspense>
  )
}
