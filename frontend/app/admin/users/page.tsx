import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { approveUser, removeUserAccess } from './server-actions'

export default async function AdminUsersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  const { data: me } = await supabase
    .from('profiles')
    .select('role, approval_status')
    .eq('id', user.id)
    .maybeSingle()

  if (me?.role !== 'admin' || me?.approval_status !== 'approved') {
    redirect('/dashboard')
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, role, approval_status, created_at')
    .order('created_at', { ascending: false })

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="mb-2 text-4xl font-bold">User Management</h1>
            <p className="text-slate-400">Admin access only</p>
          </div>

          <Link
            href="/profile"
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Back to Profile
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          {!profiles || profiles.length === 0 ? (
            <p className="text-slate-400">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Approval</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((profile) => (
                    <tr key={profile.id} className="border-b border-slate-800">
                      <td className="px-4 py-3">
                        {profile.first_name} {profile.last_name}
                      </td>
                      <td className="px-4 py-3">{profile.email}</td>
                      <td className="px-4 py-3">{profile.role}</td>
                      <td className="px-4 py-3">{profile.approval_status}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {profile.role !== 'admin' &&
                            profile.approval_status !== 'approved' && (
                              <form action={approveUser.bind(null, profile.id)}>
                                <button
                                  type="submit"
                                  className="rounded-xl bg-green-700 px-3 py-2 text-sm hover:bg-green-600"
                                >
                                  Approve
                                </button>
                              </form>
                            )}

                          {profile.role === 'admin' ? (
                            <span className="text-slate-500">
                              Cannot remove admin
                            </span>
                          ) : (
                            <form action={removeUserAccess.bind(null, profile.id)}>
                              <button
                                type="submit"
                                className="rounded-xl bg-red-700 px-3 py-2 text-sm hover:bg-red-600"
                              >
                                Remove Access
                              </button>
                            </form>
                          )}
                        </div>
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