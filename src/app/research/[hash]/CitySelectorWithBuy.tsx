'use client'

import { useState } from 'react'
import BuyButton from './BuyButton'

interface CityOption {
  /** Slug used in URLs and Stripe metadata (e.g. 'sj'). */
  slug: string
  /** Display label (e.g. 'San Jose 2025'). */
  label: string
  /** True if the user already owns the $499 SJ report — collision warning shown. */
  ownsExistingReport: boolean
}

interface CitySelectorWithBuyProps {
  hash: string
  cities: CityOption[]
}

/**
 * Wraps the city <select> + the SJ collision warning + the BuyButton in a
 * single client component so all three react to the same selectedSlug state.
 *
 * For v1 only one city (SJ) is offered. The dropdown still renders for
 * forward-compat — when more cities ship, no UI change needed beyond passing
 * additional CityOption entries.
 *
 * Collision UI per design Locked Decision #20: if the selected city is one
 * the user already owns the $499 report for, show the yellow callout below
 * the dropdown explaining what the $1,999 adds and that buying closes the
 * 7-day refund window on the existing $499 row.
 */
export default function CitySelectorWithBuy({
  hash,
  cities,
}: CitySelectorWithBuyProps) {
  // Default to the first city. For v1 this is always SJ.
  const initial = cities[0]?.slug ?? ''
  const [selectedSlug, setSelectedSlug] = useState(initial)

  const selected = cities.find((c) => c.slug === selectedSlug)
  const ownsExistingReport = selected?.ownsExistingReport ?? false

  // No cities to render = empty state. Should not happen in practice (v1 has
  // SJ seeded), but defend rather than crash.
  if (cities.length === 0) {
    return (
      <p className="font-mono text-[13px] text-muted" data-testid="research-no-cities">
        No cities are open for research right now. Check back soon.
      </p>
    )
  }

  return (
    <div>
      <label
        htmlFor="research-city-select"
        className="block font-mono text-[11px] uppercase tracking-[0.1em] text-muted mb-2"
      >
        Choose your city
      </label>
      <select
        id="research-city-select"
        value={selectedSlug}
        onChange={(e) => setSelectedSlug(e.target.value)}
        data-testid="city-select"
        className="block w-full sm:max-w-sm px-3 py-2.5 border border-ink bg-paper font-mono text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-ink"
      >
        {cities.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.label}
          </option>
        ))}
      </select>

      {ownsExistingReport && (
        <div
          data-testid="sj-collision-warning"
          className="mt-4 border border-accent px-4 py-3 bg-accent/5"
        >
          <p className="font-mono text-[12px] text-ink leading-relaxed">
            <span className="text-accent uppercase tracking-wider mr-1">Note ·</span>
            You already own the San Jose historical report. Buying the $1,999 research adds 90
            days of new permit monitoring on top, and your $499 7-day refund window will close
            upon checkout.
          </p>
        </div>
      )}

      <div className="mt-6">
        <BuyButton hash={hash} city={selectedSlug} disabled={!selectedSlug} />
      </div>
    </div>
  )
}
