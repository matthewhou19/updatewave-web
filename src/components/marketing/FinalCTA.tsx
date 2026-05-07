import Link from 'next/link'
import { buttonStyles } from '../ui/Button'

export default function FinalCTA() {
  return (
    <section className="bg-ink text-paper px-6 md:px-12 py-20 md:py-24 text-center border-b border-dashed border-paper/30">
      <h2 className="font-serif text-[36px] md:text-[56px] font-semibold leading-[1.05] tracking-tight max-w-[700px] mx-auto mb-6">
        Your next contract was filed with the city <em className="not-italic"><span className="italic text-accent">this morning.</span></em>
      </h2>
      <p className="font-mono text-[14px] opacity-70 mb-8">
        Start browsing free. Reveal the ones worth chasing.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <Link href="/login" className={buttonStyles('accent')}>
          Browse San Jose listings →
        </Link>
        <a
          href="mailto:matthew@updatewave.com"
          className={`${buttonStyles('outline')} !border-paper !text-paper hover:!bg-paper hover:!text-ink`}
        >
          Talk to us
        </a>
      </div>
    </section>
  )
}
