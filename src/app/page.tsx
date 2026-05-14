import { createSupabaseClient } from '@/lib/supabase'
import { fetchPublishedProjects, fetchHomepageStats } from '@/lib/queries'
import TopBar from '@/components/TopBar'
import Hero from '@/components/marketing/Hero'
import SocialProofStrip from '@/components/marketing/SocialProofStrip'
import HowItWorks from '@/components/marketing/HowItWorks'
import ListingsPreview from '@/components/marketing/ListingsPreview'
import ComparisonTable from '@/components/marketing/ComparisonTable'
import Testimonial from '@/components/marketing/Testimonial'
import Coverage from '@/components/marketing/Coverage'
import PricingTease from '@/components/marketing/PricingTease'
import FAQ from '@/components/marketing/FAQ'
import FinalCTA from '@/components/marketing/FinalCTA'
import Footer from '@/components/marketing/Footer'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = createSupabaseClient()

  const [{ projects }, stats] = await Promise.all([
    fetchPublishedProjects(supabase),
    fetchHomepageStats(supabase),
  ])

  const previewProjects = projects.slice(0, 4)

  return (
    <div className="bg-paper text-ink">
      <TopBar view="public" />
      <Hero />
      <SocialProofStrip stats={stats} />
      <HowItWorks />
      <ListingsPreview projects={previewProjects} totalCount={projects.length} />
      <ComparisonTable />
      <Testimonial />
      <Coverage />
      <PricingTease />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  )
}
