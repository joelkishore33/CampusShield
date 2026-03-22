import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { autoResolveExpiredThreats } from '../alerts/[eventId]/actions'
import DashboardRealtimeNotifier from '@/components/DashboardRealtimeNotifier'

function renderStatus(status: string) {
  if (status === 'pending_review') {
    return (
      <span className="rounded-full bg-yellow-500 px-3 py-1 text-sm font-medium text-slate-950">
        Pending Review
      </span>
    )
  }

  if (status === 'active_threat') {
    return (
      <span className="rounded-full bg-red-900 px-3 py-1 text-sm text-red-300">
        Active Threat
      </span>
    )
  }

  return null
}

export default async function DashboardPage() {
  await autoResolveExpiredThreats()

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .maybeSingle()

  const displayName = profile
    ? `${profile.first_name} ${profile.last_name}`
    : user.email

  const { data: alerts, error } = await supabase
    .from('alerts')
    .select('*')
    .in('status', ['pending_review', 'active_threat'])
    .order('event_timestamp', { ascending: false })

  if (error) {
    console.error(error)
  }

  const pendingReview =
    alerts?.filter((a) => a.status === 'pending_review') ?? []
  const activeThreats =
    alerts?.filter((a) => a.status === 'active_threat') ?? []

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="mb-2 text-4xl font-bold">CampusShield Dashboard</h1>
            <p className="text-slate-400">Signed in as {displayName}</p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/profile"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
            >
              Profile
            </Link>

            <Link
              href="/history"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
            >
              View History Log
            </Link>
          </div>
        </div>

        <DashboardRealtimeNotifier />

        <div className="mb-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">System Status</p>
            <h2 className="mt-2 text-2xl font-semibold text-green-400">
              Online
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Pending Review</p>
            <h2 className="mt-2 text-2xl font-semibold text-yellow-300">
              {pendingReview.length}
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Active Threats</p>
            <h2 className="mt-2 text-2xl font-semibold text-red-400">
              {activeThreats.length}
            </h2>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Open Alerts</h2>
            <p className="text-sm text-slate-400">
              Total: {alerts?.length ?? 0}
            </p>
          </div>

          {!alerts || alerts.length === 0 ? (
            <p className="text-slate-400">No open alerts.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="px-4 py-3">Event ID</th>
                    <th className="px-4 py-3">Camera</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Avg Conf</th>
                    <th className="px-4 py-3">Peak Conf</th>
                    <th className="px-4 py-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert) => (
                    <tr key={alert.id} className="border-b border-slate-800">
                      <td className="px-4 py-3">
                        <Link
                          href={`/alerts/${alert.event_id}`}
                          className="text-sky-400 hover:underline"
                        >
                          {alert.event_id}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {alert.camera_name ?? alert.camera_id ?? '-'}
                      </td>
                      <td className="px-4 py-3">{renderStatus(alert.status)}</td>
                      <td className="px-4 py-3">
                        {alert.avg_confidence ?? alert.average_confidence ?? '-'}
                      </td>
                      <td className="px-4 py-3">
                        {alert.peak_confidence ?? '-'}
                      </td>
                      <td className="px-4 py-3">
                        {alert.event_started_at
                          ? new Date(alert.event_started_at).toLocaleString()
                          : alert.event_timestamp
                            ? new Date(alert.event_timestamp).toLocaleString()
                            : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}