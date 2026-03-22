'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type AlertRow = {
  event_id: string
  status: string
  detected_object: string | null
}

export default function DashboardRealtimeNotifier() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [newAlert, setNewAlert] = useState<AlertRow | null>(null)

  useEffect(() => {
    const channel = supabase
      .channel('dashboard-alerts-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alerts',
        },
        (payload) => {
          const newRow = payload.new as AlertRow | undefined
          const oldRow = payload.old as AlertRow | undefined

          let shouldNotify = false

          if (
            payload.eventType === 'INSERT' &&
            newRow?.status === 'pending_review'
          ) {
            shouldNotify = true
          }

          if (
            payload.eventType === 'UPDATE' &&
            oldRow?.status !== 'pending_review' &&
            newRow?.status === 'pending_review'
          ) {
            shouldNotify = true
          }

          if (shouldNotify && newRow) {
            router.refresh()
            setNewAlert(newRow)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router, supabase])

  if (!newAlert) return null

  return (
    <div className="mb-6 rounded-2xl border border-yellow-500 bg-yellow-500/10 px-4 py-3 text-yellow-200">
      <div className="flex items-center justify-between gap-4">
        <div>
          New alert pending review:{' '}
          <span className="font-semibold">
            {newAlert.detected_object ?? 'Unknown object'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/alerts/${newAlert.event_id}`}
            onClick={() => setNewAlert(null)}
            className="rounded-xl bg-yellow-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-yellow-400"
          >
            View Alert
          </Link>

          <button
            type="button"
            onClick={() => setNewAlert(null)}
            className="rounded-xl border border-yellow-500 px-3 py-2 text-sm font-medium text-yellow-200 hover:bg-yellow-500/10"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}