import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { smsMetrics, validateSmsBody } from "./broadcast-rules";

const audienceSchema = z.object({
  category: z.enum(["service", "marketing"]),
  search: z.string().max(100).default(""),
  role: z.enum(["all", "user", "super_admin"]).default("all"),
  verified: z.boolean().default(false),
  page: z.number().int().min(0).max(10000).default(0),
  mode: z.enum(["none", "manual", "all_accounts", "all_eligible"]).default("none"),
  included: z.array(z.string().uuid()).max(5000).default([]),
  excluded: z.array(z.string().uuid()).max(5000).default([]),
});
const campaignSchema = z.object({ id: z.string().uuid() });
async function requireBroadcastAdmin(context: {
  supabase: { rpc: (name: "is_super_admin") => PromiseLike<{ data: unknown; error: unknown }> };
  userId: string;
}) {
  const { data, error } = await context.supabase.rpc("is_super_admin");
  if (error || data !== true) throw new Error("Not authorised to access broadcast messages.");
}

export const getBroadcastAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => audienceSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireBroadcastAdmin(context);
    const { data: audience, error } = await context.supabase.rpc("sms_admin_audience_v2", {
      p_category: data.category,
      p_search: data.search,
      p_role: data.role,
      p_verified: data.verified,
      p_page: data.page,
      p_mode: data.mode,
      p_included: data.included,
      p_excluded: data.excluded,
    });
    if (error) throw new Error("Could not load eligible recipients.");
    return audience;
  });

export const getBroadcastOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireBroadcastAdmin(context);
    const { readSmsBalance } = await import("./broadcast-provider.server");
    const [setup, counts] = await Promise.all([
      readSmsBalance(),
      context.supabase.rpc("sms_admin_overview"),
    ]);
    if (counts.error) throw new Error("Could not load messaging overview.");
    return { setup, counts: counts.data };
  });

export const getBroadcastHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ page: z.number().int().min(0).max(10000).default(0) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireBroadcastAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("sms_campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .range(data.page * 20, data.page * 20 + 19);
    if (error) throw new Error("Could not load broadcast history.");
    const campaigns = [];
    for (const campaign of rows) {
      const { data: counts, error: countError } = await context.supabase.rpc(
        "sms_admin_campaign_counts",
        { p_campaign: campaign.id },
      );
      if (countError) throw new Error("Could not load campaign results.");
      campaigns.push({ ...campaign, delivery_counts: counts });
    }
    return campaigns;
  });

export const getBroadcastReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    campaignSchema
      .extend({
        page: z.number().int().min(0).max(10000).default(0),
        status: z
          .enum([
            "all",
            "pending",
            "sending",
            "accepted",
            "sent",
            "delivered",
            "failed",
            "rejected",
            "unknown",
            "excluded",
          ])
          .default("all"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireBroadcastAdmin(context);
    let query = context.supabase
      .from("sms_recipients")
      .select("*", { count: "exact" })
      .eq("campaign_id", data.id);
    if (data.status !== "all") query = query.eq("status", data.status);
    const [recipients, events, counts] = await Promise.all([
      query.order("id").range(data.page * 25, data.page * 25 + 24),
      context.supabase
        .from("sms_events")
        .select("*")
        .eq("campaign_id", data.id)
        .order("created_at", { ascending: false })
        .limit(50),
      context.supabase.rpc("sms_admin_campaign_counts", { p_campaign: data.id }),
    ]);
    if (recipients.error || events.error || counts.error)
      throw new Error("Could not load delivery report.");
    return {
      recipients: recipients.data,
      total: recipients.count ?? 0,
      events: events.data,
      counts: counts.data,
    };
  });

export const prepareBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    audienceSchema
      .extend({
        requestKey: z.string().uuid(),
        title: z.string().trim().min(1).max(120),
        body: z.string().trim().min(1).max(1200),
        test: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireBroadcastAdmin(context);
    const issue = validateSmsBody(data.body, data.category);
    if (issue) throw new Error(issue);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!data.test && data.mode === "none") throw new Error("Select recipients first.");
    const { data: id, error } = await supabaseAdmin.rpc("sms_create_campaign_v2", {
      p_actor: context.userId,
      p_request: data.requestKey,
      p_title: data.title,
      p_body: data.body,
      p_category: data.category,
      p_segments: smsMetrics(data.body).segments,
      p_role: data.role,
      p_verified: data.verified,
      p_mode: data.mode === "none" ? "manual" : data.mode,
      p_included: data.included,
      p_excluded: data.excluded,
      p_test: data.test,
    });
    if (error || !id) throw new Error(error?.message ?? "Could not prepare broadcast.");
    const { count, error: countError } = await context.supabase
      .from("sms_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", id);
    if (countError) throw new Error("Could not confirm recipients.");
    const { data: saved } = await context.supabase
      .from("sms_campaigns")
      .select("audience")
      .eq("id", id)
      .single();
    return { id, count: count ?? 0, summary: (saved?.audience ?? null) as Record<string, unknown> | null };
  });

export const confirmBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    campaignSchema
      .extend({ count: z.number().int().positive(), confirmed: z.literal(true) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireBroadcastAdmin(context);
    const { smsSetup } = await import("./broadcast-provider.server");
    const setup = smsSetup();
    if (!setup.ready) throw new Error("Termii setup required. No SMS was sent.");
    if (!setup.liveEnabled)
      throw new Error(
        "Live sending is disabled until the owner approves activation. No SMS was sent.",
      );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("sms_queue_campaign", {
      p_actor: context.userId,
      p_campaign: data.id,
      p_count: data.count,
    });
    if (error) throw new Error(error.message);
    return { queued: true };
  });

export const processBroadcastBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => campaignSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireBroadcastAdmin(context);
    const { smsSetup, sendProviderSms } = await import("./broadcast-provider.server");
    const setup = smsSetup();
    if (!setup.ready || !setup.liveEnabled)
      throw new Error("SMS setup or sending approval required.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: campaign, error: campaignError } = await context.supabase
      .from("sms_campaigns")
      .select("body,category,status")
      .eq("id", data.id)
      .single();
    if (campaignError || !campaign) throw new Error("Campaign not found.");
    // Generic promotional traffic must not be pushed through DND routes or night restrictions.
    const lagosHour = (new Date().getUTCHours() + 1) % 24;
    if (campaign.category === "marketing" && (lagosHour < 8 || lagosHour >= 20))
      throw new Error(
        "Promotional SMS paused outside 08:00–20:00 Lagos time. Resume during permitted hours.",
      );
    const { data: batch, error } = await supabaseAdmin.rpc("sms_claim_batch", {
      p_campaign: data.id,
      p_actor: context.userId,
    });
    if (error) throw new Error("Could not claim SMS batch.");
    // Five single-recipient submissions: no unverified bulk API contract, no unbounded request.
    for (const recipient of batch ?? []) {
      const { data: allowed, error: eligibilityError } = await supabaseAdmin.rpc(
        "sms_recipient_allowed",
        { p_recipient: recipient.id },
      );
      const result =
        !eligibilityError && allowed
          ? await sendProviderSms(recipient.phone, campaign.body, campaign.category)
          : {
              status: "excluded",
              reference: null,
              reason: "Consent or recipient eligibility changed",
            };
      const { error: saveError } = await supabaseAdmin.rpc("sms_record_result", {
        p_recipient: recipient.id,
        p_status: result.status,
        p_reference: result.reference ?? (null as unknown as string),
        p_reason: result.reason ?? (null as unknown as string),
        p_actor: context.userId,
      });
      if (saveError)
        throw new Error(
          "Submission result could not be saved; reconciliation required before resending.",
        );
    }
    const { error: finishError } = await supabaseAdmin.rpc("sms_finish_campaign", {
      p_campaign: data.id,
    });
    if (finishError) throw new Error("Could not update campaign progress.");
    const { count } = await context.supabase
      .from("sms_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", data.id)
      .in("status", ["pending", "sending"]);
    return { processed: batch?.length ?? 0, remaining: count ?? 0 };
  });

export const refreshBroadcastDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => campaignSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireBroadcastAdmin(context);
    const { readProviderDelivery } = await import("./broadcast-provider.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await context.supabase
      .from("sms_recipients")
      .select("id,provider_message_id,status")
      .eq("campaign_id", data.id)
      .in("status", ["accepted", "sent", "unknown"])
      .not("provider_message_id", "is", null)
      .order("updated_at")
      .limit(5);
    if (error) throw new Error("Could not load pending delivery references.");
    for (const row of rows ?? []) {
      if (!row.provider_message_id) continue;
      const status = await readProviderDelivery(row.provider_message_id);
      if (status) {
        const { error: updateError } = await supabaseAdmin.rpc("sms_record_result", {
          p_recipient: row.id,
          p_status: status,
          p_reference: row.provider_message_id,
          p_reason: null as unknown as string,
          p_actor: context.userId,
          p_event_key: `poll:${row.provider_message_id}:${status}`,
        });
        if (updateError) throw new Error("Could not save delivery result.");
      }
    }
    return { checked: rows?.length ?? 0 };
  });

export const retryBroadcastRejected = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => campaignSchema.extend({ confirmed: z.literal(true) }).parse(input))
  .handler(async ({ data, context }) => {
    await requireBroadcastAdmin(context);
    const { smsSetup } = await import("./broadcast-provider.server");
    if (!smsSetup().ready || !smsSetup().liveEnabled)
      throw new Error("SMS setup and owner activation required.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: count, error } = await supabaseAdmin.rpc("sms_retry_rejected", {
      p_actor: context.userId,
      p_campaign: data.id,
    });
    if (error) throw new Error(error.message);
    return { count };
  });
