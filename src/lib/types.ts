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
  description: string | null
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

export type EmailStatus = 'unknown' | 'verified' | 'bounced' | 'complained'

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
  email_status?: EmailStatus
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

export type ServiceTier = 'report' | 'research'

export interface CityList {
  id: number
  city: string
  year: number
  title: string
  description: string | null
  headline_insight: string | null
  headline_insight_subtext: string | null
  price_cents: number
  anchor_price_cents: number | null
  active: boolean
  service_tier: ServiceTier
  delivery_window_days: number | null
  created_at: string
  updated_at: string
}

export interface CityListWithStoragePath extends CityList {
  pdf_storage_path: string
}

export interface ListPurchase {
  id: number
  user_id: number
  city_list_id: number
  stripe_session_id: string
  stripe_payment_id: string | null
  amount_cents: number
  purchased_at: string
}

export type DeliveryStatus = 'pending' | 'in_research' | 'delivered' | 'cancelled'

export interface ResearchPurchase {
  id: number
  user_id: number
  city_list_id: number
  stripe_session_id: string
  stripe_payment_id: string | null
  amount_cents: number
  delivery_status: DeliveryStatus
  digest_subscription_until: string
  purchased_at: string
  delivered_at: string | null
}

export interface DigestSubscription {
  id: number
  research_purchase_id: number
  city: string
  unsubscribe_token: string
  active: boolean
  unsubscribed_at: string | null
  last_sent_at: string | null
  created_at: string
}

export type EventType =
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'complained'
  | 'unsubscribed'
  | 'admin_action'

export interface DeliveryEvent {
  id: number
  user_id: number | null
  email: string
  event_type: EventType
  resend_message_id: string | null
  payload: unknown
  created_at: string
}

export type ProductType = 'reveal' | 'list' | 'research'
