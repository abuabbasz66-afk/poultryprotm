import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { sendTemplateEmail } from '@/lib/email-templates/send-email'

// Called by the client right after farm creation. Sends the welcome email to
// the new user and a notification email to every super_admin. Uses the caller's
// auth session to look up their own farm; falls back to admin lookup for
// admin emails only. Idempotency keys derived from farm_id prevent duplicates.
export const notifyNewAccount = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { farmId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context

    const { data: farm, error: farmErr } = await supabase
      .from('farms')
      .select('id, name, owner_id, owner_name, phone, country, state, subscription_plan, created_at')
      .eq('id', data.farmId)
      .maybeSingle()

    if (farmErr) throw farmErr
    if (!farm || farm.owner_id !== userId) throw new Error('forbidden')

    // Caller's email + display name (from auth claims where possible).
    const email = (context.claims as any)?.email as string | undefined
    const meta = ((context.claims as any)?.user_metadata ?? {}) as Record<string, any>
    const fullName = (meta.full_name as string | undefined) ?? farm.owner_name ?? undefined

    const registeredAt = new Date(farm.created_at).toLocaleString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })

    const templateData = {
      fullName,
      farmName: farm.name,
      email,
      phone: farm.phone ?? meta.phone,
      country: farm.country,
      state: farm.state,
      subscriptionPlan: farm.subscription_plan ?? 'basic',
      userId: farm.owner_id,
      farmId: farm.id,
      registeredAt,
    }

    // Welcome email to the new user
    if (email) {
      try {
        await sendTemplateEmail('welcome', email, {
          templateData: { fullName, farmName: farm.name },
          idempotencyKey: `welcome-${farm.id}`,
        })
      } catch (err) {
        console.error('[notifyNewAccount] welcome email failed', err)
      }
    }

    // Admin notification emails — service-role lookup of super admins.
    try {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
      const { data: admins } = await supabaseAdmin.rpc('get_super_admin_emails')
      const recipients = ((admins ?? []) as Array<{ email: string }>).map((r) => r.email).filter(Boolean)
      await Promise.all(
        recipients.map((to) =>
          sendTemplateEmail('admin-new-account', to, {
            templateData,
            idempotencyKey: `admin-new-account-${farm.id}-${to}`,
          }).catch((err) => console.error('[notifyNewAccount] admin email failed', to, err)),
        ),
      )
    } catch (err) {
      console.error('[notifyNewAccount] admin lookup failed', err)
    }

    return { ok: true }
  })
