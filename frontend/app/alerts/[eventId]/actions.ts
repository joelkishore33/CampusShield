'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type SaveState = {
  message: string
  success: boolean
}

async function updateAlertStatusAndRedirect(
  formData: FormData,
  status: string
) {
  const eventId = String(formData.get('eventId') ?? '').trim()

  if (!eventId) {
    throw new Error('Missing eventId')
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('alerts')
    .update({ status })
    .eq('event_id', eventId)

  if (error) {
    console.error(
      `[ALERT STATUS ERROR] Failed to update ${eventId} -> ${status}`,
      error
    )
    throw new Error(error.message)
  }

  revalidatePath('/dashboard')
  revalidatePath(`/alerts/${eventId}`)

  redirect('/dashboard')
}

export async function markFalseAlarm(formData: FormData) {
  await updateAlertStatusAndRedirect(formData, 'false_alarm')
}

export async function markActiveThreat(formData: FormData) {
  await updateAlertStatusAndRedirect(formData, 'active_threat')
}

export async function markPendingReview(formData: FormData) {
  await updateAlertStatusAndRedirect(formData, 'pending_review')
}

export async function autoResolveExpiredThreats() {
  const supabase = await createClient()
  const nowIso = new Date().toISOString()

  const { error } = await supabase
    .from('alerts')
    .update({ status: 'resolved' })
    .eq('status', 'active_threat')
    .not('auto_resolve_at', 'is', null)
    .lte('auto_resolve_at', nowIso)

  if (error) {
    console.error('[AUTO RESOLVE ERROR]', error)
  }
}

export async function saveOperatorNotes(
  _prevState: SaveState,
  formData: FormData
): Promise<SaveState> {
  const eventId = String(formData.get('eventId') ?? '').trim()
  const notes = String(formData.get('notes') ?? '')

  if (!eventId) {
    return {
      message: 'Missing event id',
      success: false,
    }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('alerts')
    .update({ operator_notes: notes })
    .eq('event_id', eventId)

  if (error) {
    console.error('[SAVE NOTES ERROR]', error)
    return {
      message: `Failed to save notes: ${error.message}`,
      success: false,
    }
  }

  revalidatePath('/dashboard')
  revalidatePath(`/alerts/${eventId}`)

  return {
    message: 'Notes saved',
    success: true,
  }
}