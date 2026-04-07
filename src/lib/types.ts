export interface Project {
  id: number
  city: string
  address: string
  project_type: string | null
  estimated_value_cents: number | null
  estimated_value: string | null
  architect_name: string | null
  architect_firm: string | null
  architect_contact: string | null
  architect_website: string | null
  source_permit_id: number | null
  filing_date: string | null
  source_url: string | null
  status: 'candidate' | 'published' | 'stale' | 'archived'
  reveal_count: number
  reviewed_at: string | null
  published_at: string | null
  updated_at: string
  created_at: string
}

export interface User {
  id: number
  hash: string
  name: string | null
  company: string | null
  email: string | null
  city_filter: string | null
  source_campaign: string | null
  created_at: string
  last_seen_at: string | null
  deleted_at: string | null
}

export interface Reveal {
  id: number
  user_id: number
  project_id: number
  stripe_payment_id: string | null
  amount_cents: number | null
  created_at: string
}

export interface RevealWithProject extends Reveal {
  address: string
  city: string
  project_type: string | null
  estimated_value: string | null
  architect_name: string | null
  architect_firm: string | null
  architect_contact: string | null
  architect_website: string | null
  filing_date: string | null
  source_url: string | null
  status: 'candidate' | 'published' | 'stale' | 'archived'
}
