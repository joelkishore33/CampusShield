"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

type AlertRow = {
  event_id: string
  status: string
  detected_object: string | null
  peak_confidence: number | null
  avg_confidence: number | null
  event_started_at: string | null
  best_frame_url: string | null
  footage_clip_url: string | null
}

export default function PendingAlertsPanel() {
  const supabase = useMemo(() => createClient(), [])
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [loading, setLoading] = useState(true)
  const [liveMessage, setLiveMessage] = useState("")

  useEffect(() => {
    let mounted = true

    async function loadAlerts() {
      const { data, error } = await supabase
        .from("alerts")
        .select(
          "event_id, status, detected_object, peak_confidence, avg_confidence, event_started_at, best_frame_url, footage_clip_url"
        )
        .eq("status", "pending_review")
        .order("event_started_at", { ascending: false })

      if (!mounted) return

      if (error) {
        console.error("Failed to load pending alerts:", error)
      } else {
        setAlerts(data || [])
      }

      setLoading(false)
    }

    loadAlerts()

    const channel = supabase
      .channel("alerts-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "alerts",
        },
        (payload) => {
          const newRow = payload.new as AlertRow
          const oldRow = payload.old as AlertRow

          if (payload.eventType === "INSERT") {
            if (newRow.status === "pending_review") {
              setAlerts((prev) => {
                const exists = prev.some((a) => a.event_id === newRow.event_id)
                if (exists) return prev
                return [newRow, ...prev]
              })

              setLiveMessage(
                `New pending review alert: ${newRow.detected_object ?? "Unknown object"}`
              )

              setTimeout(() => {
                setLiveMessage("")
              }, 4000)
            }
          }

          if (payload.eventType === "UPDATE") {
            setAlerts((prev) => {
              const filtered = prev.filter((a) => a.event_id !== newRow.event_id)

              if (newRow.status === "pending_review") {
                return [newRow, ...filtered]
              }

              return filtered
            })

            if (
              oldRow?.status !== "pending_review" &&
              newRow?.status === "pending_review"
            ) {
              setLiveMessage(
                `Alert moved to pending review: ${newRow.detected_object ?? "Unknown object"}`
              )

              setTimeout(() => {
                setLiveMessage("")
              }, 4000)
            }
          }

          if (payload.eventType === "DELETE") {
            setAlerts((prev) =>
              prev.filter((a) => a.event_id !== oldRow?.event_id)
            )
          }
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [supabase])

  return (
    <div className="space-y-4">
      {liveMessage && (
        <div className="rounded-xl border border-red-500 bg-red-950 px-4 py-3 text-red-100">
          {liveMessage}
        </div>
      )}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Pending Review</h2>
            <p className="text-sm text-zinc-400">
              New alerts appear automatically while the app is open.
            </p>
          </div>

          <div className="rounded-full bg-yellow-500 px-3 py-1 text-sm font-semibold text-black">
            {alerts.length}
          </div>
        </div>

        {loading ? (
          <p className="text-zinc-400">Loading alerts...</p>
        ) : alerts.length === 0 ? (
          <p className="text-zinc-400">No pending alerts.</p>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <Link
                key={alert.event_id}
                href={`/alerts/${alert.event_id}`}
                className="block rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition hover:border-zinc-700 hover:bg-zinc-800"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-white">
                      {alert.detected_object ?? "Unknown object"}
                    </p>
                    <p className="text-sm text-zinc-400">{alert.event_id}</p>
                    <p className="mt-1 text-sm text-zinc-400">
                      Peak confidence: {alert.peak_confidence ?? "N/A"}
                    </p>
                    <p className="text-sm text-zinc-400">
                      Avg confidence: {alert.avg_confidence ?? "N/A"}
                    </p>
                  </div>

                  <div className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-medium text-yellow-300">
                    {alert.status}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}