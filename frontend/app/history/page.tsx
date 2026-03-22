import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { autoResolveExpiredThreats } from '../alerts/[eventId]/actions'

function renderStatus(status: string) {
  if (status === 'false_alarm') {
    return (
      <span className="rounded-full bg-orange-900 px-3 py-1 text-sm text-orange-300">
        False Alarm
      </span>
    )
  }

  return (
    <span className="rounded-full bg-green-900 px-3 py-1 text-sm text-green-300">
      Resolved
    </span>
  )
}

export default async function HistoryPage() {
  await autoResolveExpiredThreats()

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  const { data: alerts, error } = await supabase
    .from('alerts')
    .select('*')
    .in('status', ['false_alarm', 'resolved'])
    .order('event_timestamp', { ascending: false })

  if (error) {
    console.error(error)
  }

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="mb-2 text-4xl font-bold">History Log</h1>
            <p className="text-slate-400">Resolved incidents and false alarms</p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Back to Dashboard
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          {!alerts || alerts.length === 0 ? (
            <p className="text-slate-400">No history entries yet.</p>
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
                      <td className="px-4 py-3">{alert.camera_id}</td>
                      <td className="px-4 py-3">{renderStatus(alert.status)}</td>
                      <td className="px-4 py-3">{alert.average_confidence ?? '-'}</td>
                      <td className="px-4 py-3">{alert.peak_confidence ?? '-'}</td>
                      <td className="px-4 py-3">
                        {new Date(alert.event_timestamp).toLocaleString()}
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