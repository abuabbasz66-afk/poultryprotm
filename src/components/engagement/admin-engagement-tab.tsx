import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  MessageCircle, Phone, Send, ShieldCheck, Users, AlertTriangle, History, Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { friendlyError } from "@/lib/error-message";
import {
  SEGMENT_LABEL, useCallRequests, useEngagementAudience, useEngagementHistory,
  useEngagementStats, useLogEngagementMessage, useSaveFrequencyLimits,
  useSetCallRequest, useSetMessageStatus, type AudienceRow, type Segment,
} from "@/lib/engagement";
import { campaignsForSegment, waLink, type Campaign } from "@/lib/engagement-templates";

const SEGMENT_ORDER: Segment[] = [
  "REGISTERED_NOT_SETUP", "SETUP_INCOMPLETE", "ACTIVATED_FREE", "ACTIVE_FREE",
  "INACTIVE_FREE", "CHECKOUT_STARTED", "PAYMENT_FAILED", "PREMIUM_ACTIVE",
  "PREMIUM_EXPIRING", "PREMIUM_EXPIRED", "CANCELLED",
];

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function AdminEngagementTab({ enabled }: { enabled: boolean }) {
  const [segment, setSegment] = useState<string | null>(null);
  const [target, setTarget] = useState<AudienceRow | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);

  const statsQ = useEngagementStats(enabled);
  const audienceQ = useEngagementAudience(segment, enabled);
  const callsQ = useCallRequests(enabled);
  const stats = statsQ.data ?? {};
  const segments = (stats.segments ?? {}) as Record<string, number>;
  const limits = (stats.limits ?? {}) as { per_day?: number; per_week?: number };

  const cards = [
    { label: "People we can reach", value: n(stats.total_users), icon: Users },
    { label: "WhatsApp opted in", value: n(stats.whatsapp_opt_in), icon: MessageCircle },
    { label: "SMS opted in", value: n(stats.sms_opt_in), icon: MessageCircle },
    { label: "Marketing opted in", value: n(stats.marketing_opt_in), icon: ShieldCheck },
    { label: "On a paid plan", value: n(stats.premium_users), icon: ShieldCheck },
    { label: "Free and active", value: n(stats.free_active), icon: Users },
    { label: "Inactive", value: n(stats.inactive), icon: Users },
    { label: "Plans ending soon", value: n(stats.expiring), icon: AlertTriangle },
    { label: "Plans ended", value: n(stats.expired), icon: AlertTriangle },
    { label: "Payments that failed", value: n(stats.payment_failed), icon: AlertTriangle },
    { label: "Unfinished checkouts", value: n(stats.checkout_abandoned), icon: AlertTriangle },
    { label: "Can be messaged today", value: n(stats.eligible_marketing), icon: Send },
  ];

  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-display text-xl font-semibold">Customer engagement</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every figure comes from real accounts and records. Messages are written here and sent by
          you from WhatsApp or by phone — PoultryPro never sends anything automatically.
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <c.icon className="h-3.5 w-3.5" /> {c.label}
            </div>
            <div className="mt-1 font-display text-2xl font-semibold">
              {statsQ.isLoading ? "…" : c.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <FrequencyCard perDay={limits.per_day ?? 1} perWeek={limits.per_week ?? 3} />

      <CallRequests rows={callsQ.data ?? []} loading={callsQ.isLoading} />

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSegment(null)}
            className={`rounded-full border px-3 py-1 text-xs ${segment === null ? "border-[color:var(--forest)] bg-[color:var(--forest)] text-primary-foreground" : "border-border text-muted-foreground"}`}
          >
            Everyone
          </button>
          {SEGMENT_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => setSegment(s)}
              className={`rounded-full border px-3 py-1 text-xs ${segment === s ? "border-[color:var(--forest)] bg-[color:var(--forest)] text-primary-foreground" : "border-border text-muted-foreground"}`}
            >
              {SEGMENT_LABEL[s]} ({n(segments[s])})
            </button>
          ))}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[840px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3">Farmer</th>
                <th className="py-2 pr-3">Segment</th>
                <th className="py-2 pr-3">Plan</th>
                <th className="py-2 pr-3">Records</th>
                <th className="py-2 pr-3">Last active</th>
                <th className="py-2 pr-3">Consent</th>
                <th className="py-2 pr-3" />
              </tr>
            </thead>
            <tbody>
              {audienceQ.isLoading && (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!audienceQ.isLoading && (audienceQ.data ?? []).length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No one in this group.</td></tr>
              )}
              {(audienceQ.data ?? []).map((r) => (
                <tr key={r.user_id} className="border-b border-border/60">
                  <td className="py-2 pr-3">
                    <div className="font-medium">{r.farm_name ?? r.full_name ?? "No farm yet"}</div>
                    <div className="text-xs text-muted-foreground">{r.email ?? "—"}</div>
                  </td>
                  <td className="py-2 pr-3 text-xs">{SEGMENT_LABEL[r.segment] ?? r.segment}</td>
                  <td className="py-2 pr-3 text-xs capitalize">{r.plan}</td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">
                    {[r.has_production && "production", r.has_feed && "feed", r.has_health && "health", r.has_finance && "finance"]
                      .filter(Boolean).join(", ") || "none yet"}
                  </td>
                  <td className="py-2 pr-3 text-xs">{fmtDate(r.last_activity)}</td>
                  <td className="py-2 pr-3 text-xs">
                    {r.marketing_opt_in ? "Marketing ✓" : "Service only"}
                    {r.whatsapp_opt_in ? " · WhatsApp ✓" : ""}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setHistoryFor(r.user_id)}>
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" onClick={() => setTarget(r)}>Prepare message</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {target && <ComposeDialog row={target} onClose={() => setTarget(null)} />}
      {historyFor && <HistoryDialog userId={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}

function FrequencyCard({ perDay, perWeek }: { perDay: number; perWeek: number }) {
  const [d, setD] = useState(String(perDay));
  const [w, setW] = useState(String(perWeek));
  const save = useSaveFrequencyLimits();
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-[color:var(--forest)]" />
        <h3 className="font-medium">How often a farmer may hear from us</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        These limits apply to promotional messages only. Account messages — payment, expiry,
        failures — are not limited. Nobody on a paid plan receives promotional messages.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Per 24 hours</span>
          <input value={d} onChange={(e) => setD(e.target.value)} type="number" min={0}
            className="w-24 rounded-lg border border-input bg-background px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Per 7 days</span>
          <input value={w} onChange={(e) => setW(e.target.value)} type="number" min={0}
            className="w-24 rounded-lg border border-input bg-background px-2 py-1.5 text-sm" />
        </label>
        <Button
          size="sm"
          disabled={save.isPending}
          onClick={() =>
            save.mutate(
              { per_day: Math.max(0, Number(d) || 0), per_week: Math.max(0, Number(w) || 0) },
              {
                onSuccess: () => toast.success("Limits saved"),
                onError: (e) => toast.error(friendlyError(e, "Could not save limits")),
              },
            )
          }
        >
          Save limits
        </Button>
      </div>
    </section>
  );
}

function CallRequests({ rows, loading }: { rows: ReturnType<typeof useCallRequests>["data"]; loading: boolean }) {
  const set = useSetCallRequest();
  const list = rows ?? [];
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Phone className="h-4 w-4 text-[color:var(--forest)]" />
        <h3 className="font-medium">Farmers who asked for a call</h3>
      </div>
      {loading ? (
        <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
      ) : list.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No call requests yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {list.map((c) => (
            <li key={c.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{c.farm_name ?? c.email ?? "Farmer"}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.email ?? "—"} · {c.phone ?? "no phone"} · {c.plan} · {fmtDate(c.created_at)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs capitalize">{c.status}</span>
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="text-xs underline">Call</a>
                  )}
                  {c.status === "open" && (
                    <Button size="sm" variant="outline"
                      onClick={() => set.mutate({ id: c.id, status: "done" },
                        { onError: (e) => toast.error(friendlyError(e, "Could not update")) })}>
                      Mark done
                    </Button>
                  )}
                </div>
              </div>
              {c.reason && <p className="mt-2 text-sm text-muted-foreground">{c.reason}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ComposeDialog({ row, onClose }: { row: AudienceRow; onClose: () => void }) {
  const options = useMemo(() => campaignsForSegment(row.segment), [row.segment]);
  const [campaign, setCampaign] = useState<Campaign | null>(options[0] ?? null);
  const [body, setBody] = useState(options[0] ? options[0].build(row) : "");
  const log = useLogEngagementMessage();

  const pick = (c: Campaign) => {
    setCampaign(c);
    setBody(c.build(row));
  };

  const blocked =
    campaign?.category === "marketing"
      ? row.block_reason
      : !row.phone
        ? "No phone number on record"
        : null;

  const send = () => {
    if (!campaign || !row.phone) return;
    log.mutate(
      {
        userId: row.user_id,
        farmId: row.farm_id,
        campaignKey: campaign.key,
        category: campaign.category,
        channel: "whatsapp",
        segment: row.segment,
        body,
        phone: row.phone,
      },
      {
        onSuccess: () => {
          window.open(waLink(row.phone as string, body), "_blank", "noopener");
          toast.success("Message recorded — WhatsApp opened");
          onClose();
        },
        onError: (e) => toast.error(friendlyError(e, "Message not sent")),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{row.farm_name ?? row.email ?? "Farmer"}</DialogTitle>
          <DialogDescription>
            {SEGMENT_LABEL[row.segment] ?? row.segment} · {row.phone ?? "no phone number"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {options.map((c) => (
            <button key={c.key} onClick={() => pick(c)}
              className={`rounded-full border px-3 py-1 text-xs ${campaign?.key === c.key ? "border-[color:var(--forest)] bg-[color:var(--forest)] text-primary-foreground" : "border-border text-muted-foreground"}`}>
              {c.label}
            </button>
          ))}
        </div>

        {campaign && (
          <p className="text-xs text-muted-foreground">
            {campaign.purpose} · {campaign.category === "service" ? "Account message" : "Promotional message"}
          </p>
        )}

        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} className="text-sm" />

        {blocked ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700">
            Cannot send: {blocked}.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Sending opens WhatsApp with this message ready. It is also saved to this farmer's message history.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={send} disabled={!!blocked || !campaign || log.isPending}>
            <Send className="h-4 w-4" /> Send on WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const q = useEngagementHistory(userId, true);
  const set = useSetMessageStatus();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Message history</DialogTitle>
          <DialogDescription>Everything PoultryPro has sent this farmer.</DialogDescription>
        </DialogHeader>
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (q.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages sent yet.</p>
        ) : (
          <ul className="space-y-3">
            {(q.data ?? []).map((m) => (
              <li key={m.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{m.campaign_key} · {m.channel} · {m.category}</span>
                  <span>{fmtDate(m.sent_at)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{m.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-border px-2 py-0.5 capitalize">{m.status}</span>
                  {["replied", "clicked", "opted_out"].map((s) => (
                    <button key={s} className="underline"
                      onClick={() => set.mutate({ id: m.id, status: s })}>
                      Mark {s.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
