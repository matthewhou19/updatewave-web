/**
 * TODO: Replace with a real customer story before any meaningful launch push.
 * Until then, the placeholder note below is rendered visibly so we never
 * mistake the section for verified social proof.
 */
export default function Testimonial() {
  return (
    <section className="bg-grey-100 border-b border-dashed border-ink px-6 md:px-12 py-16 md:py-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-8">
          <h2 className="font-serif text-[32px] md:text-[44px] leading-tight font-semibold tracking-tight max-w-[800px]">
            &ldquo;We stopped chasing. They started calling us.&rdquo;
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-12 mt-12 items-start">
          <div>
            <p className="font-serif text-[24px] md:text-[32px] leading-snug tracking-tight mb-8">
              <span className="font-serif italic text-accent text-[64px] leading-none align-[-0.3em] mr-2">
                &ldquo;
              </span>
              I&apos;d been chasing every lead I could find. The report told me most of the SFR work
              was going to a handful of LLCs I&apos;d never even contacted. Two of them are now repeat
              clients. I stopped wasting Q1 on the wrong customer segment.
            </p>
            <div className="flex items-center gap-3 mt-6">
              <div className="w-12 h-12 rounded-full bg-grey-200 border border-grey-300" aria-hidden />
              <div>
                <div className="font-mono text-[13px] font-bold">[Customer Name]</div>
                <div className="font-mono text-[11px] text-muted">Owner · [GC Company] · San Jose, CA</div>
              </div>
            </div>
            <p className="font-mono text-[11px] text-muted italic mt-8 border-t border-dashed border-grey-300 pt-3">
              ⚠ Placeholder — this section will be replaced with a verified customer story before
              launch. Showing realistic-but-marked copy until then.
            </p>
          </div>

          <div>
            <StatCard num="2" label="Repeat clients from one report" />
            <StatCard num="6" label="LLCs newly on the radar" />
            <StatCard num="5min" label="Time to read the report" />
          </div>
        </div>
      </div>
    </section>
  )
}

function StatCard({ num, label }: { num: string; label: string }) {
  return (
    <div className="border border-ink p-6 mb-3 bg-paper">
      <div className="font-serif text-[44px] md:text-[48px] font-semibold leading-none text-accent">{num}</div>
      <div className="font-mono text-[11px] text-muted mt-2 uppercase tracking-[0.08em]">{label}</div>
    </div>
  )
}
