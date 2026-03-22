import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  autoResolveExpiredThreats,
  markActiveThreat,
  markFalseAlarm,
  markPendingReview,
} from './actions'
import OperatorNotesEditor from '@/components/OperatorNotesEditor'

type PageProps = {
  params: Promise<{
    eventId: string
  }>
}

function renderStatus(status: string) {
  if (status === 'pending_review') {
    return (
      <span className="rounded-full bg-yellow-500 px-3 py-1 text-sm font-medium text-slate-950">
        pending review
      </span>
    )
  }

  if (status === 'false_alarm') {
    return (
      <span className="rounded-full bg-orange-900 px-3 py-1 text-sm text-orange-300">
        false alarm
      </span>
    )
  }

  if (status === 'active_threat') {
    return (
      <span className="rounded-full bg-red-900 px-3 py-1 text-sm text-red-300">
        active threat
      </span>
    )
  }

  return (
    <span className="rounded-full bg-green-900 px-3 py-1 text-sm text-green-300">
      resolved
    </span>
  )
}

function formatDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return '-'

  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60

  if (mins === 0) return `${secs}s`
  return `${mins}m ${secs}s`
}

function getDurationFromTimes(
  startedAt?: string | null,
  endedAt?: string | null
) {
  if (!startedAt || !endedAt) return null

  const start = new Date(startedAt).getTime()
  const end = new Date(endedAt).getTime()

  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null
  return Math.round((end - start) / 1000)
}

export default async function AlertDetailsPage({ params }: PageProps) {
  await autoResolveExpiredThreats()

  const { eventId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  const { data: alert, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle()

  if (error) {
    console.error(error)
  }

  if (!alert) {
    notFound()
  }

  const detectedObject = alert.detected_object ?? alert.object_label ?? '-'
  const avgConfidence = alert.avg_confidence ?? alert.average_confidence ?? '-'
  const peakConfidence = alert.peak_confidence ?? '-'
  const timestamp = alert.timestamp ?? alert.event_timestamp
  const notes = alert.operator_notes ?? alert.notes ?? ''
  const cameraName = alert.camera_name ?? alert.camera_id ?? '-'

  const durationSeconds =
    alert.event_duration_seconds ??
    getDurationFromTimes(alert.event_started_at, alert.event_ended_at)

  const presagePulse = alert.presage_pulse_bpm ?? null
  const presageBreathing = alert.presage_breathing_rate_bpm ?? null
  const presageConfidence = alert.presage_confidence ?? null
  const presageStatus = alert.presage_status ?? null
  const presageNotes = alert.presage_notes ?? null

  const hasClip = Boolean(alert.footage_clip_url)

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <Link href="/dashboard" className="text-sky-400 hover:underline">
            ← Back to Dashboard
          </Link>
          <h1 className="mt-4 text-4xl font-bold">Alert Details</h1>
          <p className="mt-2 text-slate-400">
            Review incident evidence and event metadata
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl bg-gradient-to-br from-[#0d1b3d] to-[#0a0f1f] p-8 shadow-xl">
            <h2 className="mb-6 text-3xl font-bold">Event Info</h2>
            <div className="space-y-4 text-slate-300 text-xl">
              <p>Event ID: {alert.event_id}</p>
              <p>Camera: {cameraName}</p>
              <p>
                Status: <span className="ml-2">{renderStatus(alert.status)}</span>
              </p>
              <p>Object: {detectedObject}</p>
              <p>Average Confidence: {avgConfidence}</p>
              <p>Peak Confidence: {peakConfidence}</p>
              <p>
                Timestamp:{' '}
                {timestamp ? new Date(timestamp).toLocaleString() : '-'}
              </p>
              <p>
                Auto Resolve At:{' '}
                {alert.auto_resolve_at
                  ? new Date(alert.auto_resolve_at).toLocaleString()
                  : '-'}
              </p>
              <p>Event Duration: {formatDuration(durationSeconds)}</p>
            </div>
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-[#0d1b3d] to-[#0a0f1f] p-8 shadow-xl">
            <h2 className="mb-6 text-3xl font-bold">Evidence</h2>

            {alert.best_frame_url ? (
              <div className="mb-4 overflow-hidden rounded-2xl border border-slate-700">
                <img
                  src={alert.best_frame_url}
                  alt="Highest confidence frame"
                  className="h-[310px] w-full object-cover"
                />
              </div>
            ) : (
              <div className="mb-4 flex h-[310px] items-center justify-center rounded-2xl border border-dashed border-slate-600 text-slate-400">
                No frame uploaded yet
              </div>
            )}

            {hasClip ? (
              <a
                href={alert.footage_clip_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-xl bg-sky-600 px-4 py-3 text-base font-medium text-white hover:bg-sky-500"
              >
                Watch Clip
              </a>
            ) : (
              <button
                disabled
                className="inline-flex cursor-not-allowed rounded-xl bg-slate-700 px-4 py-3 text-base font-medium text-slate-400"
              >
                Watch Clip
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 rounded-3xl bg-gradient-to-br from-[#0d1b3d] to-[#0a0f1f] p-8 shadow-xl">
          <h2 className="mb-6 text-3xl font-bold">Operator Notes</h2>
          <OperatorNotesEditor
            eventId={alert.event_id}
            initialNotes={notes}
          />
        </div>

        <div className="mt-8 rounded-3xl bg-gradient-to-br from-[#0d1b3d] to-[#0a0f1f] p-8 shadow-xl">
          <h2 className="mb-6 text-3xl font-bold">Presage Vitals</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4 text-slate-300 text-xl">
              <p>
                Pulse:{' '}
                {presagePulse !== null ? `${presagePulse} bpm` : '-'}
              </p>
              <p>
                Breathing Rate:{' '}
                {presageBreathing !== null ? `${presageBreathing} bpm` : '-'}
              </p>
              <p>Confidence: {presageConfidence ?? '-'}</p>
              <p>Status: {presageStatus ?? '-'}</p>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-5 text-lg text-slate-300">
              {presageNotes ?? 'No Presage notes available.'}
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-3xl bg-gradient-to-br from-[#0d1b3d] to-[#0a0f1f] p-8 shadow-xl">
          <h2 className="mb-6 text-3xl font-bold">Operator Actions</h2>
          <div className="flex flex-wrap gap-4">
            <form action={markFalseAlarm}>
              <input type="hidden" name="eventId" value={alert.event_id} />
              <button className="rounded-2xl bg-orange-600 px-6 py-4 text-2xl hover:bg-orange-500">
                Mark False Alarm
              </button>
            </form>

            <form action={markActiveThreat}>
              <input type="hidden" name="eventId" value={alert.event_id} />
              <button className="rounded-2xl bg-red-600 px-6 py-4 text-2xl hover:bg-red-500">
                Mark Active Threat
              </button>
            </form>

            <form action={markPendingReview}>
              <input type="hidden" name="eventId" value={alert.event_id} />
              <button className="rounded-2xl bg-yellow-500 px-6 py-4 text-2xl text-slate-950 hover:bg-yellow-400">
                Reset to Pending Review
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}