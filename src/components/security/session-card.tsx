import { useEffect, useState } from "react";
import { MonitorSmartphone, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { detectClient, logSecurityEvent, timeAgo } from "@/lib/security-events";
import { friendlyError } from "@/lib/error-message";

/**
 * Session visibility for the signed-in user. Shows device, browser and sign-in
 * time only — never a token, refresh token or any session secret.
 */
export function SessionCard() {
  const [info, setInfo] = useState<{ signedInAt: string | null; email: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const client = detectClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session;
      const issuedAt = s?.expires_at ? new Date((s.expires_at - (s.expires_in ?? 3600)) * 1000).toISOString() : null;
      setInfo({ signedInAt: issuedAt, email: s?.user?.email ?? null });
    });
  }, []);

  const signOutOthers = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw error;
      void logSecurityEvent("sessions_revoked", { detail: "Signed out of all other devices" });
      toast.success("Signed out of all other devices");
    } catch (e) {
      toast.error(friendlyError(e, "Could not sign out other devices"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-soft)] md:p-6">
      <div className="flex items-start gap-3">
        <MonitorSmartphone className="mt-0.5 h-5 w-5 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold">This device</h2>
          <p className="mt-1 text-sm text-muted-foreground">Where your account is signed in right now.</p>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <Row label="Device" value={client.device} />
            <Row label="Browser" value={`${client.browser} on ${client.os}`} />
            <Row label="Account" value={info?.email ?? "—"} />
            <Row label="Signed in" value={info?.signedInAt ? timeAgo(info.signedInAt) : "This session"} />
          </dl>

          <div className="mt-4">
            <Button variant="outline" className="rounded-full" onClick={signOutOthers} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} Sign out of all other devices
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium">{value}</dd>
    </div>
  );
}
