import { supabase } from "@/integrations/supabase/client";
import { logSecurityEvent } from "@/lib/security-events";

/**
 * Two-factor authentication (authenticator app / TOTP).
 *
 * Enrolment, challenge and verification all happen inside Supabase Auth — the
 * app never stores a secret, a code or a token itself. Platform administrators
 * are required to complete 2FA before the admin console opens; for farm users
 * it is optional and never forced retroactively.
 */

export type TotpFactor = { id: string; friendlyName: string | null; status: string };

export async function listTotpFactors(): Promise<TotpFactor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  const all = [...(data?.totp ?? []), ...(data?.all ?? [])];
  const seen = new Set<string>();
  return all
    .filter((f) => f.factor_type === "totp")
    .filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)))
    .map((f) => ({ id: f.id, friendlyName: f.friendly_name ?? null, status: f.status }));
}

export async function hasVerifiedTotp(): Promise<boolean> {
  try {
    const factors = await listTotpFactors();
    return factors.some((f) => f.status === "verified");
  } catch {
    return false;
  }
}

/** True when this session was signed in but has not yet passed the 2FA step. */
export async function needsTotpChallenge(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  return data.nextLevel === "aal2" && data.currentLevel !== "aal2";
}

/** The session has fully satisfied 2FA. */
export async function isTwoFactorSatisfied(): Promise<boolean> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.currentLevel === "aal2";
}

export async function startEnrolment(friendlyName: string) {
  // A stale unverified factor blocks a fresh enrolment; clear it first.
  const existing = await listTotpFactors();
  for (const f of existing.filter((x) => x.status !== "verified")) {
    await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => undefined);
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName });
  if (error) throw error;
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function confirmEnrolment(factorId: string, code: string) {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
  if (error) throw error;
  void logSecurityEvent("mfa_enabled", { detail: "Authenticator app verified" });
}

export async function verifyChallenge(code: string) {
  const factors = await listTotpFactors();
  const factor = factors.find((f) => f.status === "verified");
  if (!factor) throw new Error("No authenticator app is set up on this account.");
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
  if (error) throw error;
  void logSecurityEvent("mfa_verified", { detail: "Two-step code accepted" });
}

export async function disableTotp() {
  const factors = await listTotpFactors();
  for (const f of factors) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (error) throw error;
  }
  void logSecurityEvent("mfa_disabled", { detail: "Authenticator app removed" });
}
