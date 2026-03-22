'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthPage() {
  const supabase = createClient()
  const router = useRouter()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignUp() {
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
        },
      },
    })

    setLoading(false)
    setMessage(
      error
        ? error.message
        : 'Account created. Check your email to verify your account.'
    )
  }

  async function handleSignIn() {
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setLoading(false)
      setMessage(error.message)
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id

    if (!userId) {
      setLoading(false)
      setMessage('Could not load signed-in user.')
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, approval_status')
      .eq('id', userId)
      .maybeSingle()

    if (profileError || !profile) {
      await supabase.auth.signOut()
      setLoading(false)
      setMessage('This account is not authorized to access CampusShield.')
      return
    }

    if (profile.approval_status !== 'approved') {
      await supabase.auth.signOut()
      setLoading(false)
      setMessage('Your account is pending admin approval.')
      return
    }

    router.push('/dashboard')
    setLoading(false)
  }

  async function resendVerification() {
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setLoading(false)
    setMessage(error ? error.message : 'Verification email sent again.')
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <h1 className="text-3xl font-bold mb-2">CampusShield</h1>
        <p className="text-slate-400 mb-6">Authorized access only</p>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('signin')}
            className={`rounded-xl px-4 py-2 ${mode === 'signin' ? 'bg-red-600' : 'bg-slate-800'}`}
          >
            Sign In
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`rounded-xl px-4 py-2 ${mode === 'signup' ? 'bg-red-600' : 'bg-slate-800'}`}
          >
            Sign Up
          </button>
        </div>

        <div className="space-y-4">
          {mode === 'signup' && (
            <>
              <input
                type="text"
                placeholder="first name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3"
              />

              <input
                type="text"
                placeholder="last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3"
              />
            </>
          )}

          <input
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3"
          />

          <input
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3"
          />

          {mode === 'signin' ? (
            <button
              onClick={handleSignIn}
              disabled={loading}
              className="w-full rounded-xl bg-red-600 px-4 py-3 font-medium hover:bg-red-500 disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          ) : (
            <button
              onClick={handleSignUp}
              disabled={loading}
              className="w-full rounded-xl bg-red-600 px-4 py-3 font-medium hover:bg-red-500 disabled:opacity-60"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          )}

          <a
            href="/forgot-password"
            className="block text-sm text-sky-400 hover:underline"
          >
            Forgot password?
          </a>

          <button
            onClick={resendVerification}
            disabled={!email || loading}
            className="text-left text-sm text-sky-400 hover:underline disabled:opacity-50"
          >
            Resend verification email
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