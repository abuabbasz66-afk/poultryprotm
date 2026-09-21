import { useEffect, useState } from "react";
import { ShieldCheck, Loader2, KeyRound, Smartphone, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { friendlyError } from "@/lib/error-message";
import { confirmEnrolment, disableTotp, hasVerifiedTotp, startEnrolment } from "@/lib/mfa";

/**
 * Optional two-step sign-in with an authenticator app. Required for platform
 * administrators (enforced separately on the admin console), optional for
 * every farm user — nobody is locked out by enabling this feature.
 */
export function TwoFactorCard({ required = false }: { required?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");

  const refresh = async () => {
    setLoading(true);
    setEnabled(await hasVerifiedTotp());
    setLoading(false);
  };

  useEffect(() => { void refresh(); }, []);

  const begin = async () => {
    setBusy(true);
    try {
      setSetup(await startEnrolment("PoultryPro"));
      setCode("");
    } catch (e) {
      toast.error(friendlyError(e, "Could not start two-step setup"));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!setup) return;
    setBusy(true);
    try {
      await confirmEnrolment(setup.factorId, code);
      setSetup(null);
      setCode("");
      await refresh();
      toast.success("Two-step sign-in is now on");
    } catch (e) {
      toast.error(friendlyError(e, "That code did not match. Try the next one."));
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      await disableTotp();
      await refresh();
      toast.success("Two-step sign-in turned off");
    } catch (e) {
      toast.error(friendlyError(e, "Could not turn off two-step sign-in"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-soft)] md:p-6">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold">Two-step sign-in</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask for a 6-digit code from an authenticator app each time you sign in on a new device.
          </p>

          {loading ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking your account…
            </div>
          ) : enabled ? (
            <div className="mt-4 space-y-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" /> Two-step sign-in is on
              </span>
              {!required && (
                <div>
                  <Button variant="outline" className="rounded-full" onClick={turnOff} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Turn off
                  </Button>
                </div>
              )}
            </div>
          ) : setup ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm">
                Scan this with Google Authenticator, Microsoft Authenticator or Authy, then enter the 6-digit code it shows.
              </p>
              <div
                className="w-40 rounded-xl border border-border bg-white p-2"
                dangerouslySetInnerHTML={{ __html: setup.qr }}
              />
              <p className="text-xs text-muted-foreground">
                Can't scan? Enter this key manually: <span className="font-mono">{setup.secret}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="w-32 rounded-xl border border-input bg-background px-3 py-2 text-center font-mono text-sm tracking-[0.3em] outline-none focus:border-[color:var(--forest)]"
                />
                <Button className="rounded-full" onClick={confirm} disabled={busy || code.length !== 6}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Confirm
                </Button>
                <Button variant="ghost" className="rounded-full" onClick={() => setSetup(null)} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {required && (
                <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Two-step sign-in is required for platform administrator accounts.
                </p>
              )}
              <Button className="rounded-full" onClick={begin} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />} Set up two-step sign-in
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
