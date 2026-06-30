'use client'

import { useState, useTransition } from 'react'
import { buttonStyles } from '@/components/ui/Button'
import { approveLead, rejectLead, withdrawLead, type ActionResult } from './actions'

interface ReviewActionsProps {
  projectId: number
  status: 'candidate' | 'published'
}

export default function ReviewActions({ projectId, status }: ReviewActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  function run(action: (id: number) => Promise<ActionResult>) {
    setError(null)
    startTransition(async () => {
      const result = await action(projectId)
      if (!result.ok) {
        setError(result.error)
        setConfirming(false)
      }
      // On success, the action calls revalidatePath('/admin/leads'), which
      // re-renders the page and moves this card to the other section.
    })
  }

  // Published leads: a single, confirmed "withdraw" (takes it off the live site,
  // back to the pending queue).
  if (status === 'published') {
    return (
      <Wrapper error={error}>
        {confirming ? (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(withdrawLead)}
              className={buttonStyles('accent')}
              data-testid="confirm-withdraw"
            >
              {isPending ? '处理中…' : '确认撤回 ✓'}
            </button>
            <CancelButton disabled={isPending} onClick={() => setConfirming(false)} />
          </>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setConfirming(true)}
            className={buttonStyles('outline')}
            data-testid="withdraw"
          >
            撤回批准
          </button>
        )}
      </Wrapper>
    )
  }

  // Candidate leads: approve (confirmed, it goes live) + reject.
  return (
    <Wrapper error={error}>
      {confirming ? (
        <>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(approveLead)}
            className={buttonStyles('accent')}
            data-testid="confirm-approve"
          >
            {isPending ? '处理中…' : '确认上线 ✓'}
          </button>
          <CancelButton disabled={isPending} onClick={() => setConfirming(false)} />
        </>
      ) : (
        <>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setConfirming(true)}
            className={buttonStyles('primary')}
            data-testid="approve"
          >
            批准上线
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(rejectLead)}
            className={buttonStyles('outline')}
            data-testid="reject"
          >
            {isPending ? '处理中…' : '拒绝'}
          </button>
        </>
      )}
    </Wrapper>
  )
}

function Wrapper({ children, error }: { children: React.ReactNode; error: string | null }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">{children}</div>
      {error && (
        <p className="font-mono text-[12px] text-accent" data-testid="review-error">
          <span className="uppercase tracking-wider mr-1">Error ·</span>
          {error}
        </p>
      )}
    </div>
  )
}

function CancelButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={buttonStyles('outline', 'sm')}>
      取消
    </button>
  )
}
