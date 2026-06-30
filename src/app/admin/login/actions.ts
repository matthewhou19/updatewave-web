'use server'

import { redirect } from 'next/navigation'
import { checkAdminPassword, setAdminSession, clearAdminSession } from '@/lib/admin-auth'
import { sanitizeNext } from '@/lib/safe-next'

export async function loginAdmin(formData: FormData): Promise<void> {
  const password = String(formData.get('password') ?? '')
  const next = sanitizeNext(String(formData.get('next') ?? '')) ?? '/admin/leads'

  if (!checkAdminPassword(password)) {
    redirect(`/admin/login?error=1&next=${encodeURIComponent(next)}`)
  }

  await setAdminSession()
  redirect(next)
}

export async function logoutAdmin(): Promise<void> {
  await clearAdminSession()
  redirect('/admin/login')
}
