import { useEffect, useState } from "react";
import { MessageCircle, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { friendlyError } from "@/lib/error-message";
import {
  useCommunicationPrefs, useMyCallRequests, useRequestCall, useSaveCommunicationPrefs,
  type CommunicationPrefs,
} from "@/lib/engagement";

const ROWS: { key: keyof CommunicationPrefs; label: string; hint: string }[] = [
  { key: "subscriptionNotificationsOptIn", label: "Account and subscription messages", hint: "Payments, plan changes and expiry. We recommend keeping these on." },
  { key: "marketingOptIn", label: "Tips and plan updates", hint: "Occasional helpful messages about features and plans." },
  { key: "whatsappOptIn", label: "Contact me on WhatsApp", hint: "Allows PoultryPro to message you on WhatsApp." },
  { key: "smsOptIn", label: "Contact me by SMS", hint: "Short text messages for important subscription matters." },
  { key: "phoneContactOptIn", label: "Allow a phone call", hint: "We may call you if you need help." },
];

export function CommunicationPreferencesCard() {
  const prefsQ = useCommunicationPrefs();
  const save = useSaveCommunicationPrefs();
  const [prefs, setPrefs] = useState<CommunicationPrefs | null>(null);

  useEffect(() => {
    if (prefsQ.data) setPrefs(prefsQ.data);
  }, [prefsQ.data]);

  const update = (key: keyof CommunicationPrefs, value: boolean | string) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: value } as CommunicationPrefs;
    setPrefs(next);
    save.mutate(next, {
      onError: (e) => toast.error(friendlyError(e, "Could not save your choice")),
    });
  };

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-soft)] md:p-6">
      <div className="flex items-start gap-3">
        <MessageCircle className="mt-0.5 h-5 w-5 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold">How PoultryPro may contact you</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You decide which messages you receive, and you can change this at any time.
          </p>

          <label className="mt-5 block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Phone number for messages</span>
            <input
              value={prefs?.phone ?? ""}
              onChange={(e) => setPrefs(prefs ? { ...prefs, phone: e.target.value } : prefs)}
              onBlur={() => prefs && update("phone", prefs.phone ?? "")}
              placeholder="e.g. 0803 000 0000"
              className="w-full max-w-xs rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[color:var(--forest)]"
            />
          </label>

          <div className="mt-4 divide-y divide-border">
            {ROWS.map((row) => (
              <label key={String(row.key)} className="flex min-h-12 items-center justify-between gap-4 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block">{row.label}</span>
                  <span className="block text-xs text-muted-foreground">{row.hint}</span>
                </span>
                <Switch
                  aria-label={row.label}
                  checked={Boolean(prefs?.[row.key])}
                  disabled={!prefs}
                  onCheckedChange={(checked) => update(row.key, checked)}
                />
              </label>
            ))}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Turning off tips and plan updates stops all promotional messages immediately.
          </p>
        </div>
      </div>
    </section>
  );
}

export function RequestCallCard() {
  const prefsQ = useCommunicationPrefs();
  const requests = useMyCallRequests();
  const request = useRequestCall();
  const [reason, setReason] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (prefsQ.data?.phone) setPhone(prefsQ.data.phone);
  }, [prefsQ.data?.phone]);

  const open = (requests.data ?? []).some((r) => r.status === "open" || r.status === "scheduled");

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-soft)] md:p-6">
      <div className="flex items-start gap-3">
        <PhoneCall className="mt-0.5 h-5 w-5 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold">Need help? Ask us to call you</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell us what you need help with and someone from PoultryPro will get in touch.
          </p>

          {open ? (
            <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">
              Your request has been received. We will call you on the number you gave us.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                className="w-full max-w-xs rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[color:var(--forest)]"
              />
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="What would you like help with?"
                className="text-sm"
              />
              <Button
                disabled={request.isPending || !phone.trim()}
                onClick={() =>
                  request.mutate(
                    { reason: reason.trim(), phone: phone.trim() },
                    {
                      onSuccess: () => {
                        toast.success("We have your request — we will call you.");
                        setReason("");
                      },
                      onError: (e) => toast.error(friendlyError(e, "Could not send your request")),
                    },
                  )
                }
              >
                Request a call
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
