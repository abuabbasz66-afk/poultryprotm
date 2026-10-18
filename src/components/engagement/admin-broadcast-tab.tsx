import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Send,
  ShieldCheck,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getBroadcastAudience,
  getBroadcastOverview,
  getBroadcastHistory,
  getBroadcastReport,
  prepareBroadcast,
  confirmBroadcast,
  processBroadcastBatch,
  refreshBroadcastDelivery,
  retryBroadcastRejected,
} from "@/lib/broadcast.functions";
import { smsMetrics, validateSmsBody, type BroadcastCategory } from "@/lib/broadcast-rules";

type Audience = {
  total_registered: number;
  valid_phones: number;
  eligible: number;
  excluded: number;
  duplicate_phones: number;
  total_matches: number;
  rows: {
    user_id: string;
    display_name: string;
    phone: string | null;
    verified: boolean;
    role_key: string;
    eligible: boolean;
    exclusion: string | null;
  }[];
};
type Counts = {
  total_registered: number;
  valid_phones: number;
  messages_sent: number;
  accepted: number;
  delivered: number;
  delivery_final: number;
};
const dateTime = (value: string) =>
  new Date(value).toLocaleString("en-NG", { timeZone: "Africa/Lagos" });
const deliveryStates = [
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
] as const;
export function AdminBroadcastTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const overviewFn = useServerFn(getBroadcastOverview),
    audienceFn = useServerFn(getBroadcastAudience),
    historyFn = useServerFn(getBroadcastHistory),
    reportFn = useServerFn(getBroadcastReport);
  const prepareFn = useServerFn(prepareBroadcast),
    confirmFn = useServerFn(confirmBroadcast),
    processFn = useServerFn(processBroadcastBatch),
    refreshFn = useServerFn(refreshBroadcastDelivery);
  const retryFn = useServerFn(retryBroadcastRejected);
  const [retryConfirm, setRetryConfirm] = useState(false);
  const [category, setCategory] = useState<BroadcastCategory>("service"),
    [role, setRole] = useState<"all" | "user" | "super_admin">("all"),
    [verified, setVerified] = useState(false);
  const [group, setGroup] = useState("all"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const [draft, setDraft] = useState<{
    id: string;
    count: number;
    test: boolean;
    body: string;
    title: string;
  } | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null),
    [historyPage, setHistoryPage] = useState(0),
    [reportPage, setReportPage] = useState(0),
    [deliveryFilter, setDeliveryFilter] = useState<(typeof deliveryStates)[number]>("all");
  const requestKey = useRef<string | null>(null),
    running = useRef(false);
  useEffect(() => {
    requestKey.current = null;
    setPage(0);
  }, [title, body, category, role, verified, group, selected]);
  const overview = useQuery({
    queryKey: ["broadcast", userId, "overview"],
    queryFn: () => overviewFn(),
  });
  const audience = useQuery({
    queryKey: ["broadcast", userId, "audience", category, role, verified, page, search],
    queryFn: async () =>
      (await audienceFn({
        data: { category, role, verified, page, search, selected: null },
      })) as unknown as Audience,
  });
  const chosen = useQuery({
    queryKey: ["broadcast", userId, "chosen", category, role, verified, selected],
    enabled: group === "selected",
    queryFn: async () =>
      (await audienceFn({
        data: { category, role, verified, page: 0, search: "", selected },
      })) as unknown as Audience,
  });
  const history = useQuery({
    queryKey: ["broadcast", userId, "history", historyPage],
    queryFn: () => historyFn({ data: { page: historyPage } }),
  });
  const report = useQuery({
    queryKey: ["broadcast", userId, "report", campaignId, reportPage, deliveryFilter],
    enabled: Boolean(campaignId),
    queryFn: () => {
      if (!campaignId) throw new Error("Select a campaign");
      return reportFn({ data: { id: campaignId, page: reportPage, status: deliveryFilter } });
    },
  });
  const setup = overview.data?.setup;
  const counts = overview.data?.counts as unknown as Counts | undefined;
  const recipients = group === "selected" ? chosen.data : audience.data;
  const metrics = smsMetrics(body),
    issue = validateSmsBody(body, category);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["broadcast", userId] });
  async function prepare(test: boolean) {
    if (issue) {
      toast.error(issue);
      return;
    }
    setBusy(true);
    try {
      const key = requestKey.current ?? crypto.randomUUID();
      requestKey.current = key;
      const result = await prepareFn({
        data: {
          category,
          role,
          verified,
          selected: group === "selected" ? selected : null,
          page: 0,
          search: "",
          requestKey: key,
          title,
          body,
          test,
        },
      });
      setDraft({ ...result, test, body, title });
      setConfirmed(false);
      await invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not prepare campaign");
    } finally {
      setBusy(false);
    }
  }
  async function runQueue(id: string) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      // Persistent queue; bounded requests. Closing the page pauses, never cancels or re-sends a claimed recipient.
      let remaining = 1;
      while (remaining > 0) {
        const result = await processFn({ data: { id } });
        remaining = result.remaining;
        await invalidate();
        if (result.processed === 0) break;
      }
      toast.success("Queue processing updated. Provider acceptance is not confirmed delivery.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Queue paused");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  async function confirm() {
    if (!draft || !confirmed) return;
    setBusy(true);
    try {
      await confirmFn({ data: { id: draft.id, count: draft.count, confirmed: true } });
      const id = draft.id;
      setCampaignId(id);
      setDraft(null);
      await invalidate();
      setBusy(false);
      await runQueue(id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No SMS was sent");
      setBusy(false);
    }
  }
  const activeCampaign = history.data?.find((c) => c.id === campaignId);
  return (
    <div className="space-y-7 text-foreground">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase text-primary font-semibold">PoultryPro communications</p>
          <h1 className="mt-2 text-3xl font-display">Broadcast Messages</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Account-based SMS campaigns · All times shown in Lagos time
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Refresh messaging centre"
          onClick={() => void invalidate()}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </header>
      {overview.isError && (
        <p role="alert" className="text-destructive">
          Messaging overview could not be loaded. Retry or check your admin access.
        </p>
      )}
      <div className="border-l-4 border-gold bg-secondary p-4 text-sm">
        <ShieldCheck className="inline h-4 w-4 mr-2" />
        {!setup
          ? "Checking SMS setup…"
          : !setup.ready
            ? "Setup required: configure Termii credentials, account API URL and approved sender ID. No SMS can be sent."
            : !setup.liveEnabled
              ? "Termii configured. Live sending remains disabled until the owner approves activation."
              : `Termii connected · Sender: ${setup.sender}`}
        {setup?.ready && !setup.webhookReady && (
          <p className="mt-2">Delivery webhook setup required; reports can be checked manually.</p>
        )}
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        {[
          ["Registered users", counts?.total_registered],
          ["Valid phone numbers", counts?.valid_phones],
          ["Sent / delivered", counts?.messages_sent],
          [
            "Delivery success",
            counts?.delivery_final
              ? `${Math.round((counts.delivered / counts.delivery_final) * 100)}%`
              : "Not available",
          ],
          [
            "SMS balance",
            setup?.balance != null ? `${setup.currency ?? ""} ${setup.balance}` : "Not available",
          ],
        ].map(([label, value]) => (
          <div key={String(label)} className="border border-border rounded-lg bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 text-xl font-semibold">{value ?? "—"}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {counts?.accepted ?? 0} submissions awaiting delivery confirmation. Success rate uses final
        delivered, failed and rejected results only; no delivery is guaranteed.
      </p>
      <Tabs defaultValue="compose">
        <TabsList className="flex flex-wrap h-auto justify-start">
          <TabsTrigger value="compose">Compose Message</TabsTrigger>
          <TabsTrigger value="history">Broadcast History</TabsTrigger>
          <TabsTrigger value="reports">Delivery Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="compose" className="mt-6 space-y-6">
          <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-8">
            <section className="space-y-4 min-w-0">
              <h2 className="text-2xl font-display">Compose Message</h2>
              <label className="block text-sm">
                Campaign title
                <Input
                  value={title}
                  maxLength={120}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-2"
                  placeholder="Internal campaign reference"
                />
              </label>
              <label className="block text-sm">Communication type</label>
              <Select value={category} onValueChange={(v) => setCategory(v as BroadcastCategory)}>
                <SelectTrigger aria-label="Communication type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="service">Essential service communication</SelectItem>
                  <SelectItem value="marketing">Promotional campaign</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Both require SMS opt-in. Promotional campaigns also require marketing consent and
                respect DND restrictions; service messages must not contain promotions.
              </p>
              <label className="block text-sm">
                Message body
                <Textarea
                  value={body}
                  maxLength={1200}
                  rows={7}
                  onChange={(e) => setBody(e.target.value)}
                  className="mt-2"
                  placeholder="PoultryPro: …"
                />
              </label>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>{metrics.characters} characters</span>
                <span>{metrics.encoding}</span>
                <span>{metrics.segments} SMS segments / recipient</span>
                <span>{metrics.segments * (recipients?.eligible ?? 0)} estimated units</span>
              </div>
              {category === "marketing" && (
                <p className="text-xs text-muted-foreground">
                  Include https://poultrypro.life/settings so recipients can change their SMS and
                  promotional preferences. Promotional sending is limited to 08:00–20:00 Lagos time.
                </p>
              )}
            </section>
            <section className="min-w-0">
              <h2 className="text-2xl font-display">Message preview</h2>
              <div className="mt-4 border border-border rounded-lg bg-card p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <MessageSquare className="h-4 w-4" />
                  {setup?.sender ?? "PoultryPro"}
                </div>
                <p className="mt-4 whitespace-pre-wrap break-words text-sm min-h-24">
                  {body || "Your message will appear here."}
                </p>
                <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                  Estimated cost: unavailable — obtain your current Nigeria route rate from Termii.
                  Final charges depend on encoding, route and provider billing.
                </p>
              </div>
            </section>
          </div>
          <section className="border-y border-border py-6 space-y-4">
            <h2 className="font-display text-2xl">Recipients</h2>
            <div className="flex flex-wrap items-center gap-4">
              <Select value={group} onValueChange={setGroup}>
                <SelectTrigger className="w-full sm:w-60" aria-label="Recipient group">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All eligible registered users</SelectItem>
                  <SelectItem value="selected">Selected users</SelectItem>
                </SelectContent>
              </Select>
              <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                <SelectTrigger className="w-full sm:w-48" aria-label="User role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All account roles</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="super_admin">Super administrator</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={verified} onCheckedChange={(v) => setVerified(v === true)} />
                Verified phone only
              </label>
            </div>
            <p className="text-sm">
              <strong>{recipients?.eligible ?? "—"} recipients</strong> ·{" "}
              {recipients?.excluded ?? "—"} excluded · {recipients?.duplicate_phones ?? 0}{" "}
              shared-number duplicates removed
            </p>
            <p className="text-xs text-muted-foreground">
              Valid format does not mean verified ownership. Exclusions include missing/invalid
              numbers, consent and inactive accounts. Existing SMS and marketing preferences can be
              changed in account settings.
            </p>
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search registered users"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Search name or registered phone"
                className="pl-9"
                maxLength={100}
              />
            </div>
            {audience.isError && (
              <p role="alert" className="text-destructive text-sm">
                Recipient list could not be loaded.
              </p>
            )}
            <div className="divide-y divide-border">
              {audience.data?.rows.map((row) => (
                <label key={row.user_id} className="flex items-start gap-3 py-3 text-sm">
                  <Checkbox
                    disabled={!row.eligible || group !== "selected"}
                    checked={selected.includes(row.user_id)}
                    onCheckedChange={(v) =>
                      setSelected((current) =>
                        v === true
                          ? [...current, row.user_id]
                          : current.filter((id) => id !== row.user_id),
                      )
                    }
                    aria-label={`Select ${row.display_name}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold break-words">{row.display_name}</span>
                    <span className="block text-muted-foreground break-words">
                      {row.phone ?? "No valid registered number"} · {row.role_key} ·{" "}
                      {row.verified ? "Verified" : "Not phone-verified"}
                    </span>
                    {row.exclusion && (
                      <span className="block text-xs text-destructive">{row.exclusion}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous recipient page"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs">
                Page {page + 1} · {audience.data?.total_matches ?? 0} matches
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label="Next recipient page"
                disabled={(page + 1) * 25 >= (audience.data?.total_matches ?? 0)}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={busy || !title.trim() || Boolean(issue) || !recipients?.eligible}
              onClick={() => void prepare(false)}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Now
            </Button>
            <Button
              variant="outline"
              disabled={busy || !title.trim() || Boolean(issue)}
              onClick={() => void prepare(true)}
            >
              Send Test SMS
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Test SMS uses only your own eligible registered phone. The next step is explicit
            confirmation; preparing a draft sends nothing.
          </p>
        </TabsContent>
        <TabsContent value="history" className="mt-6 space-y-4">
          <h2 className="text-2xl font-display">Broadcast History</h2>
          {history.isError && <p role="alert">Could not load campaigns.</p>}
          {!history.isPending && history.data?.length === 0 && (
            <p className="text-muted-foreground text-sm">No campaigns recorded.</p>
          )}
          {history.data?.map((c) => (
            <article key={c.id} className="border border-border bg-card rounded-lg p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="text-lg font-semibold">
                  {c.title}
                  {c.is_test ? " · Test" : ""}
                </h3>
                <span className="text-xs font-semibold uppercase text-primary">
                  {c.status.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">{c.body}</p>
              <p className="mt-3 text-xs text-muted-foreground break-words">
                {c.admin_label} · {dateTime(c.created_at)} · {c.category}
              </p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => {
                  setCampaignId(c.id);
                  setReportPage(0);
                }}
              >
                View delivery results
              </Button>
            </article>
          ))}
          <div className="flex gap-3">
            <Button
              variant="outline"
              disabled={historyPage === 0}
              onClick={() => setHistoryPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={(history.data?.length ?? 0) < 20}
              onClick={() => setHistoryPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="reports" className="mt-6 space-y-4">
          <h2 className="font-display text-2xl">Delivery Reports</h2>
          <Select
            value={campaignId ?? ""}
            onValueChange={(v) => {
              setCampaignId(v);
              setReportPage(0);
            }}
          >
            <SelectTrigger aria-label="Campaign delivery report">
              <SelectValue placeholder="Select a campaign" />
            </SelectTrigger>
            <SelectContent>
              {history.data?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {campaignId && (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries((report.data?.counts ?? {}) as Record<string, number>).map(
                  ([status, count]) => (
                    <span className="border border-border rounded-md px-3 py-2" key={status}>
                      {status}: {count}
                    </span>
                  ),
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  disabled={busy || !setup?.ready}
                  onClick={async () => {
                    try {
                      await refreshFn({ data: { id: campaignId } });
                      await invalidate();
                    } catch {
                      toast.error("Delivery check unavailable; no status has been assumed.");
                    }
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  Check delivery
                </Button>
                {["queued", "sending"].includes(activeCampaign?.status ?? "") && (
                  <Button
                    disabled={busy || !setup?.liveEnabled}
                    onClick={() => void runQueue(campaignId)}
                  >
                    Resume queue
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Queued processing pauses if this page closes. Resume here; accepted or uncertain
                submissions are never automatically resent. Completed means queue processing ended,
                not guaranteed delivery.
              </p>
              <Button variant="outline" disabled={busy || !setup?.liveEnabled || !["failed", "partially_failed", "completed"].includes(activeCampaign?.status ?? "")} onClick={() => setRetryConfirm(true)}>
                Review rejected submissions for retry
              </Button>
              <Select
                value={deliveryFilter}
                onValueChange={(v) => {
                  setDeliveryFilter(v as typeof deliveryFilter);
                  setReportPage(0);
                }}
              >
                <SelectTrigger aria-label="Filter delivery status" className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {deliveryStates.map((s) => (
                    <SelectItem value={s} key={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {report.data?.recipients.map((r) => (
                <div key={r.id} className="border-b border-border py-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>
                      {r.display_name} · {r.phone}
                    </span>
                    <strong className="text-primary">{r.status}</strong>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {r.failure_reason ?? ""}
                    {r.provider_message_id ? ` · Reference: ${r.provider_message_id}` : ""} ·
                    Attempts: {r.attempts}
                  </p>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  disabled={reportPage === 0}
                  onClick={() => setReportPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-xs">{report.data?.total ?? 0} results</span>
                <Button
                  variant="outline"
                  disabled={(reportPage + 1) * 25 >= (report.data?.total ?? 0)}
                  onClick={() => setReportPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
              <h3 className="text-lg font-display">Action history</h3>
              {report.data?.events.map((e) => (
                <p className="text-xs border-b border-border py-2" key={e.id}>
                  {dateTime(e.created_at)} · {e.event.replaceAll("_", " ")}
                  {e.detail ? ` · ${e.detail}` : ""}
                  {e.actor_id
                    ? ` · Administrator ${e.actor_id.slice(0, 8)}`
                    : " · Provider / system"}
                </p>
              ))}
            </>
          )}
        </TabsContent>
      </Tabs>
      <Dialog
        open={Boolean(draft)}
        onOpenChange={(open) => {
          if (!open && !busy) setDraft(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm {draft?.test ? "test SMS" : "broadcast"}</DialogTitle>
            <DialogDescription>
              Review the exact saved message and recipient count. No delivery is guaranteed.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm font-semibold">{draft?.title}</p>
          <p className="text-sm whitespace-pre-wrap break-words border border-border rounded-md p-3">
            {draft?.body}
          </p>
          <p className="text-sm">
            {draft?.count} recipients · {draft ? smsMetrics(draft.body).segments * draft.count : 0}{" "}
            estimated SMS units
          </p>
          <p className="text-xs text-muted-foreground">
            Estimated cost unavailable. Termii will charge according to your account rates.
          </p>
          {!setup?.ready || !setup.liveEnabled ? (
            <p role="alert" className="text-sm text-destructive">
              Sending disabled: provider setup and owner approval required. This remains a draft.
            </p>
          ) : null}
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />I
            confirm this message, its recipients and the applicable consent and service/promotional
            classification.
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              disabled={!confirmed || busy || !setup?.ready || !setup.liveEnabled}
              onClick={() => void confirm()}
            >
              <Send className="h-4 w-4" />
              Confirm and send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={retryConfirm} onOpenChange={setRetryConfirm}>
        <DialogContent><DialogHeader><DialogTitle>Confirm safe retry</DialogTitle><DialogDescription>Only explicit provider rejections without a message reference can be retried, with a maximum of three attempts. Delivered, accepted, failed-after-acceptance and unknown submissions are excluded.</DialogDescription></DialogHeader>
          <p className="text-sm">Campaign: {activeCampaign?.title} · Consent will be checked again before sending. Additional provider charges may apply.</p>
          <DialogFooter><Button variant="outline" onClick={() => setRetryConfirm(false)}>Cancel</Button><Button disabled={busy || !campaignId || !setup?.liveEnabled} onClick={async () => {
            if (!campaignId) return;
            setBusy(true);
            try { await retryFn({ data: { id: campaignId, confirmed: true } }); setRetryConfirm(false); setBusy(false); await runQueue(campaignId); }
            catch (error) { toast.error(error instanceof Error ? error.message : "Retry unavailable"); setBusy(false); }
          }}>Confirm retry</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
