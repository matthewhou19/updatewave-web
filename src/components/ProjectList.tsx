'use client'

import { useEffect, useRef, useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Project } from '@/lib/types'
import { formatProjectType } from '@/lib/utils'
import ProjectCard from './ProjectCard'
import { buttonStyles } from './ui/Button'

interface ProjectListProps {
  projects: Project[]
  revealedProjectIds: number[]
  hash?: string
}

interface Filters {
  cities: string[]
  projectTypes: string[]
}

const STORAGE_KEY = 'uw_filters'

function loadFilters(): Filters {
  if (typeof window === 'undefined') return { cities: [], projectTypes: [] }
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored) as Filters
  } catch {
    // ignore parse errors
  }
  return { cities: [], projectTypes: [] }
}

function pillStyles(active: boolean): string {
  const base = 'font-mono text-[11px] px-3 py-1.5 border cursor-pointer transition-colors'
  return active
    ? `${base} border-ink bg-ink text-paper`
    : `${base} border-ink bg-transparent text-ink hover:bg-ink/5`
}

function ProjectListInner({ projects, revealedProjectIds, hash }: ProjectListProps) {
  const searchParams = useSearchParams()
  const justRevealedId = searchParams.get('revealed') ? parseInt(searchParams.get('revealed')!, 10) : null
  const [filters, setFilters] = useState<Filters>({ cities: [], projectTypes: [] })
  const filtersLoaded = useRef(false)

  // Load filters from localStorage after hydration (can't read localStorage during SSR)
  useEffect(() => {
    if (!filtersLoaded.current) {
      filtersLoaded.current = true
      const stored = loadFilters()
      if (stored.cities.length > 0 || stored.projectTypes.length > 0) {
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
    setFilters({ cities: [], projectTypes: [] })
  }

  const hasActiveFilters = filters.cities.length > 0 || filters.projectTypes.length > 0
  const revealedSet = new Set(revealedProjectIds)

  return (
    <div className="max-w-[1200px] mx-auto px-6 md:px-12 py-8">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {allCities.length > 0 && (
          <>
            <span className="font-mono text-[11px] text-muted uppercase tracking-wider mr-1">City:</span>
            {allCities.map((city) => (
              <button key={city} onClick={() => toggleCity(city)} className={pillStyles(filters.cities.includes(city))}>
                {city}
              </button>
            ))}
          </>
        )}
        {allProjectTypes.length > 0 && (
          <>
            <span className="font-mono text-[11px] text-muted uppercase tracking-wider md:ml-4 mr-1">Type:</span>
            {allProjectTypes.map((type) => (
              <button
                key={type}
                onClick={() => toggleProjectType(type)}
                className={pillStyles(filters.projectTypes.includes(type))}
              >
                {formatProjectType(type)}
              </button>
            ))}
          </>
        )}
        {hasActiveFilters && (
          <button onClick={clearFilters} className="font-mono text-[11px] text-muted underline ml-2">
            Clear
          </button>
        )}
      </div>

      <p className="font-mono text-[11px] text-muted uppercase tracking-wider mb-4">
        Showing {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
      </p>

      {filteredProjects.length === 0 ? (
        <div className="text-center py-16 border border-grey-300 border-dashed">
          <p className="font-serif text-[24px] mb-1">No projects match your filters.</p>
          <p className="font-mono text-[12px] text-muted">Try adjusting your city or project type.</p>
          {hasActiveFilters && (
            <button onClick={clearFilters} className={`mt-4 ${buttonStyles('primary')}`}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
    </div>
  )
}

export default function ProjectList(props: ProjectListProps) {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1200px] mx-auto px-6 md:px-12 py-8">
          <p className="font-mono text-[11px] text-muted uppercase tracking-wider">Loading...</p>
        </div>
      }
    >
      <ProjectListInner {...props} />
    </Suspense>
  )
}
