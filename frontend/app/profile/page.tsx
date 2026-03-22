import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { deleteOwnAccess, signOutUser } from './actions'

function formatRole(role: string | null | undefined) {
  if (role === 'admin') return 'Admin'
  return 'Security Officer'
}

export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

const { data: profile } = await supabase
  .from('profiles')
  .select('id, email, first_name, last_name, role, approval_status, created_at')
  .eq('id', user.id)
  .maybeSingle()

  if (!profile) {
    redirect('/auth')
  }

  const fullName = `${profile.first_name} ${profile.last_name}`.trim()

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="mb-2 text-4xl font-bold">Profile</h1>
            <p className="text-slate-400">
              Manage your CampusShield account
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Back to Dashboard
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-4 text-2xl font-semibold">Account Info</h2>

            <div className="space-y-4 text-slate-200">
              <p>
                <span className="text-slate-400">Name:</span> {fullName}
              </p>
              <p>
                <span className="text-slate-400">Email:</span> {profile.email}
              </p>
              <p>
                <span className="text-slate-400">Role:</span> {formatRole(profile.role)}
              </p>
              <p>
                <span className="text-slate-400">Registered Since:</span>{' '}
                {new Date(profile.created_at).toLocaleString()}
              </p>
              <p>
                <span className="text-slate-400">Unique ID:</span> {profile.id}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-4 text-2xl font-semibold">Account Actions</h2>

            <div className="flex flex-col gap-3">
              <form action={signOutUser}>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-slate-700 px-4 py-3 font-medium hover:bg-slate-600"
                >
                  Sign Out
                </button>
              </form>

              <form action={deleteOwnAccess}>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-red-700 px-4 py-3 font-medium hover:bg-red-600"
                >
                  Delete Account Access
                </button>
              </form>
            </div>
          </div>
        </div>

        {profile.role === 'admin' && (
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Admin Controls</h2>
                <p className="mt-1 text-slate-400">
                  Manage who can access CampusShield
                </p>
              </div>

              <Link
                href="/admin/users"
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
              >
                Manage Users
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}