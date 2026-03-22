import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user?.id && user.email) {
      const firstName = user.user_metadata?.first_name ?? ''
      const lastName = user.user_metadata?.last_name ?? ''

      const role = user.email === 'joelkishore33@gmail.com' ? 'admin' : 'security'
      const approvalStatus = user.email === 'joelkishore33@gmail.com' ? 'approved' : 'pending'

      await supabase.from('profiles').upsert({
        id: user.id,
        email: user.email,
        first_name: firstName,
        last_name: lastName,
        role,
        approval_status: approvalStatus,
      })
    }
  }

  return NextResponse.redirect(`${origin}/auth`)
}