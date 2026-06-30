'use client'

import { useState, useTransition } from 'react'
import { buttonStyles } from '@/components/ui/Button'
import { approveLead, rejectLead, type ActionResult } from './actions'

interface ReviewActionsProps {
  projectId: number
}

export default function ReviewActions({ projectId }: ReviewActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<'published' | 'archived' | null>(null)
  const [confirmingApprove, setConfirmingApprove] = useState(false)

  function run(action: (id: number) => Promise<ActionResult>, kind: 'published' | 'archived') {
    setError(null)
    startTransition(async () => {
      const result = await action(projectId)
      if (result.ok) {
        setDone(kind)
      } else {
        setError(result.error)
        setConfirmingApprove(false)
      }
    })
  }

  if (done) {
    return (
      <p className="font-mono text-[12px] text-muted" data-testid="review-done">
        {done === 'published' ? '✓ 已上线' : '✓ 已拒绝（归档）'}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {confirmingApprove ? (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(approveLead, 'published')}
              className={buttonStyles('accent')}
              data-testid="confirm-approve"
            >
              {isPending ? '处理中…' : '确认上线 ✓'}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirmingApprove(false)}
              className={buttonStyles('outline', 'sm')}
            >
              取消
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirmingApprove(true)}
              className={buttonStyles('primary')}
              data-testid="approve"
            >
              批准上线
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(rejectLead, 'archived')}
              className={buttonStyles('outline')}
              data-testid="reject"
            >
              {isPending ? '处理中…' : '拒绝'}
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="font-mono text-[12px] text-accent" data-testid="review-error">
          <span className="uppercase tracking-wider mr-1">Error ·</span>
          {error}
        </p>
      )}
    </div>
  )
}
