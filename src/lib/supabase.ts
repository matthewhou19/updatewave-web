import { createClient } from '@supabase/supabase-js'

export function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  if (!supabaseKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set')

  return createClient(supabaseUrl, supabaseKey)
}

export function createSupabaseServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')

  return createClient(supabaseUrl, serviceRoleKey)
}
