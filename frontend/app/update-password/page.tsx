'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  async function updatePassword() {
    const { error } = await supabase.auth.updateUser({ password })
    setMessage(error ? error.message : 'Password updated successfully.')
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <h1 className="text-3xl font-bold mb-2">Update Password</h1>
        <div className="space-y-4">
          <input
            type="password"
            placeholder="new password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3"
          />
          <button
            onClick={updatePassword}
            className="w-full rounded-xl bg-red-600 px-4 py-3 font-medium"
          >
            Update Password
          </button>
          {message && (
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm">
              {message}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}