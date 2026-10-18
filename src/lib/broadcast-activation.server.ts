import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { activationPermissions } from "./broadcast-activation-rules";
import { smsSetup, smsConfigurationFingerprint } from "./broadcast-provider.server";

export function requireSmsOwner(userId: string) {
  if (!process.env["SMS_OWNER_USER_ID"] || process.env["SMS_OWNER_USER_ID"] !== userId)
    throw new Error("Only the designated platform owner may approve SMS activation or send the verification test.");
}
export async function readSmsActivation(userId: string) {
  const { data, error } = await supabaseAdmin.from("platform_settings").select("value")
    .eq("key", "sms_owner_activation").maybeSingle();
  if (error) throw new Error("Could not check SMS activation. Sending remains blocked.");
  const state = (data?.value ?? {}) as Record<string, unknown>;
  const setup = smsSetup();
  const fingerprint = await smsConfigurationFingerprint();
  const verifiedAt = typeof state.verified_at === "string" ? state.verified_at : null;
  const permissions = activationPermissions({
    ownerMatches: state.owner_id === process.env["SMS_OWNER_USER_ID"],
    fingerprintMatches: state.fingerprint === fingerprint,
    providerVerified: setup.ready && setup.webhookReady,
    verifiedAt, routeApproved: state.route_approved === true,
    enabled: state.enabled === true, receiptConfirmed: typeof state.receipt_confirmed_at === "string",
  });
  return { ...permissions, isOwner: process.env["SMS_OWNER_USER_ID"] === userId,
    ownerConfigured: Boolean(process.env["SMS_OWNER_USER_ID"]), verifiedAt,
    testCampaign: typeof state.test_campaign === "string" ? state.test_campaign : null,
    receiptConfirmed: typeof state.receipt_confirmed_at === "string", fingerprint };
}
export async function assertSmsCampaignPermission(userId: string, id: string) {
  const activation = await readSmsActivation(userId);
  const { data: campaign, error } = await supabaseAdmin.from("sms_campaigns")
    .select("is_test,admin_user_id,category").eq("id", id).single();
  if (error || !campaign) throw new Error("Campaign not found.");
  if (campaign.is_test) {
    requireSmsOwner(userId);
    if (!activation.testEnabled || activation.testCampaign !== id || campaign.admin_user_id !== userId)
      throw new Error("Verify provider configuration and authorise this single-number test first.");
    const { data: recipients } = await supabaseAdmin.from("sms_recipients").select("user_id").eq("campaign_id",id);
    if (campaign.category !== "service" || recipients?.length !== 1 || recipients[0]?.user_id !== userId)
      throw new Error("Test SMS is restricted to the owner's own eligible registered number.");
  } else if (!activation.liveEnabled) throw new Error("Live broadcasts require owner activation after a confirmed test.");
  return activation;
}