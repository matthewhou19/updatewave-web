import Link from 'next/link'
import { buttonStyles } from '../ui/Button'

export default function FinalCTA() {
  return (
    <section className="bg-ink text-paper px-6 md:px-12 py-20 md:py-24 text-center border-b border-dashed border-paper/30">
      <h2 className="font-serif text-[36px] md:text-[56px] font-semibold leading-[1.05] tracking-tight max-w-[760px] mx-auto mb-6">
        Stop guessing your market. <em className="not-italic"><span className="italic text-accent">Get the structural analysis.</span></em>
      </h2>
      <p className="font-mono text-[14px] opacity-70 mb-8">
        $349 for San Jose 2025. Instant download. 7-day refund.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <Link href="/pricing" className={buttonStyles('accent')}>
          See the SJ report →
        </Link>
        <a
          href="mailto:matthew@updatewave.com?subject=Custom%20research%20for%20my%20city"
          className={`${buttonStyles('outline')} !border-paper !text-paper hover:!bg-paper hover:!text-ink`}
        >
          Talk about your city
        </a>
      </div>
    </section>
  )
}
