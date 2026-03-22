'use client'

import { useActionState } from 'react'
import { saveOperatorNotes } from '@/app/alerts/[eventId]/actions'

type Props = {
  eventId: string
  initialNotes: string
}

type SaveState = {
  message: string
  success: boolean
}

const initialState: SaveState = {
  message: '',
  success: false,
}

export default function OperatorNotesEditor({
  eventId,
  initialNotes,
}: Props) {
  const [state, formAction, pending] = useActionState(
    saveOperatorNotes,
    initialState
  )

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="eventId" value={eventId} />

      <textarea
        name="notes"
        defaultValue={initialNotes}
        placeholder="Leave a note for this alert..."
        className="min-h-[140px] w-full rounded-2xl border border-slate-700 bg-slate-950 p-4 text-lg text-white outline-none placeholder:text-slate-500 focus:border-sky-500"
      />

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-sky-600 px-5 py-3 text-base font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Saving...' : 'Save Notes'}
        </button>

        {state.message ? (
          <p
            className={`text-sm ${
              state.success ? 'text-green-300' : 'text-red-300'
            }`}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  )
}