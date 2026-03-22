'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
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

  return supabase
}

export async function approveUser(profileId: string) {
  const supabase = await requireAdmin()

  const { error } = await supabase
    .from('profiles')
    .update({ approval_status: 'approved' })
    .eq('id', profileId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/admin/users')
  revalidatePath('/profile')
}

export async function removeUserAccess(profileId: string) {
  const supabase = await requireAdmin()

  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', profileId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/admin/users')
  revalidatePath('/dashboard')
}