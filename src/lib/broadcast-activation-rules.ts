/** Public-safe decision logic; identity and evidence are loaded only on the server. */
export function activationPermissions(input: {
  ownerMatches: boolean;
  fingerprintMatches: boolean;
  providerVerified: boolean;
  verifiedAt: string | null;
  routeApproved: boolean;
  enabled: boolean;
  receiptConfirmed: boolean;
}, now = Date.now()) {
  const timestamp = input.verifiedAt ? Date.parse(input.verifiedAt) : NaN;
  const current = input.ownerMatches && input.fingerprintMatches && input.providerVerified
    && input.routeApproved && Number.isFinite(timestamp) && timestamp <= now
    && now - timestamp < 24 * 60 * 60 * 1000;
  return { testEnabled: current, liveEnabled: current && input.enabled && input.receiptConfirmed };
}