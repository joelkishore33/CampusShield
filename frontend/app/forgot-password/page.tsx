'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  async function sendResetEmail() {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    })

    setMessage(error ? error.message : 'Password reset email sent.')
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <h1 className="text-3xl font-bold mb-2">Forgot Password</h1>
        <div className="space-y-4">
          <input
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3"
          />
          <button
            onClick={sendResetEmail}
            className="w-full rounded-xl bg-red-600 px-4 py-3 font-medium"
          >
            Send Reset Email
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