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
  updateSmsActivation,
} from "@/lib/broadcast.functions";
import { smsMetrics, validateSmsBody, type BroadcastCategory } from "@/lib/broadcast-rules";

type Audience = {
  total_registered: number;
  filtered_accounts: number;
  filtered_valid_phones: number;
  filtered_eligible_accounts: number;
  selected_accounts: number;
  selected_valid_phones: number;
  selected_invalid_phones: number;
  selected_eligible_accounts: number;
  eligible: number;
  excluded: number;
  duplicate_phones: number;
  consent_not_recorded: number;
  exclusion_reasons: Record<string, number>;
  total_matches: number;
  rows: {
    user_id: string;
    display_name: string;
    phone: string | null;
    verified: boolean;
    role_key: string;
    consent_status: "granted" | "declined" | "not_recorded";
    consent_warning: boolean;
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
  const activationFn = useServerFn(updateSmsActivation);
  const [approvalAction, setApprovalAction] = useState<"verify" | "receipt" | "enable" | "disable" | null>(null);
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);
  const [retryConfirm, setRetryConfirm] = useState(false);
  const [category, setCategory] = useState<BroadcastCategory>("service"),
    [role, setRole] = useState<"all" | "user" | "super_admin">("all"),
    [verified, setVerified] = useState(false);
  type Mode = "none" | "manual" | "all_accounts" | "all_eligible";
  const [mode, setMode] = useState<Mode>("none"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [included, setIncluded] = useState<string[]>([]),
    [excluded, setExcluded] = useState<string[]>([]);
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
    summary: Record<string, unknown> | null;
  } | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null),
    [historyPage, setHistoryPage] = useState(0),
    [reportPage, setReportPage] = useState(0),
    [deliveryFilter, setDeliveryFilter] = useState<(typeof deliveryStates)[number]>("all");
  const requestKey = useRef<string | null>(null),
    running = useRef(false);
  const requestTest = useRef<boolean | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [activeTab, setActiveTab] = useState("compose");
  useEffect(() => {
    requestKey.current = null;
  }, [title, body, category, role, verified, mode, included, excluded]);
  useEffect(() => setPage(0), [role, verified, category]);
  const overview = useQuery({
    queryKey: ["broadcast", userId, "overview"],
    queryFn: () => overviewFn(),
  });
  const audience = useQuery({
    queryKey: [
      "broadcast",
      userId,
      "audience",
      category,
      role,
      verified,
      page,
      search,
      mode,
      included,
      excluded,
    ],
    placeholderData: (prev) => prev,
    queryFn: async () =>
      (await audienceFn({
        data: { category, role, verified, page, search, mode, included, excluded },
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
  const activation = overview.data?.activation;
  const draftCanSend = draft?.test ? activation?.isOwner && activation.testEnabled : activation?.liveEnabled;
  async function applyApproval() {
    if (!approvalAction || !approvalConfirmed) return;
    setBusy(true);
    try {
      await activationFn({ data: { action: approvalAction, confirmed: true,
        campaign: approvalAction === "receipt" ? activation?.testCampaign ?? undefined : undefined } });
      setApprovalAction(null);
      setApprovalConfirmed(false);
      await invalidate();
      toast.success("SMS approval status updated. No SMS was sent by this action.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Approval could not be updated"); }
    finally { setBusy(false); }
  }
  const counts = overview.data?.counts as unknown as Counts | undefined;
  const recipients = audience.data;
  const isBulk = mode === "all_accounts" || mode === "all_eligible";
  const isChecked = (row: Audience["rows"][number]) =>
    mode === "manual"
      ? included.includes(row.user_id)
      : mode === "all_accounts"
        ? !excluded.includes(row.user_id)
        : mode === "all_eligible"
          ? row.eligible && !excluded.includes(row.user_id)
          : false;
  const toggleRow = (id: string, on: boolean) => {
    if (isBulk) setExcluded((c) => (on ? c.filter((x) => x !== id) : [...new Set([...c, id])]));
    else {
      setMode("manual");
      setIncluded((c) => (on ? [...new Set([...c, id])] : c.filter((x) => x !== id)));
    }
  };
  const chooseBulk = (next: "all_accounts" | "all_eligible", on: boolean) => {
    setExcluded([]);
    setIncluded([]);
    setMode(on ? next : "none");
  };
  const metrics = smsMetrics(body),
    issue = validateSmsBody(body, category);
  const recipientSummaryPending = audience.isFetching || audience.isPlaceholderData;
  const sendBlockReason = busy
    ? "Please wait for the current request to finish."
    : !title.trim()
      ? "Enter a campaign title."
      : issue
        ? issue
        : mode === "none"
          ? "Select accounts or eligible phone numbers."
          : audience.isError
            ? "Recipient details could not be loaded. Refresh and try again."
            : recipientSummaryPending
              ? "Checking the selected recipients…"
              : !recipients?.eligible
                ? "No selected accounts can receive this SMS. Review phone numbers, filters and communication preferences."
                : null;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["broadcast", userId] });
  async function prepare(test: boolean) {
    if (issue) {
      toast.error(issue);
      return;
    }
    setBusy(true);
    try {
      if (requestTest.current !== test) requestKey.current = null;
      requestTest.current = test;
      const key = requestKey.current ?? crypto.randomUUID();
      requestKey.current = key;
      const result = await prepareFn({
        data: {
          category,
          role,
          verified,
          mode,
          included,
          excluded,
          page: 0,
          search: "",
          requestKey: key,
          title,
          body,
          test,
        },
      });
      setDraft({
        id: result.id,
        count: result.count,
        summary: JSON.parse(result.summary) as Record<string, unknown> | null,
        test,
        body: body.trim(),
        title: title.trim(),
      });
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
      while (remaining > 0 && mounted.current) {
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
              ? "Termii settings saved. Live broadcasts remain disabled until verification, a received owner test and explicit activation."
              : `Live broadcasts enabled · Sender: ${setup.sender}`}
        {setup?.ready && !setup.webhookReady && (
          <p className="mt-2">Delivery webhook setup required; reports can be checked manually.</p>
        )}
      </div>
      <section className="border-y border-border py-5 space-y-3" aria-label="SMS configuration and owner approval">
        <h2 className="text-xl font-display">SMS configuration and owner approval</h2>
        <dl className="grid gap-2 sm:grid-cols-2 text-sm">
          {[
            ["Termii API key", setup?.configured.apiKey],
            ["HTTPS account API URL", setup?.configured.baseUrl],
            ["Sender ID format", setup?.configured.senderId],
            ["Delivery-signing secret", setup?.configured.deliverySecret],
            ["Designated owner", activation?.ownerConfigured],
          ].map(([label, ready]) => <div key={String(label)} className="flex justify-between gap-3">
            <dt>{label}</dt><dd>{ready ? "Configured" : "Missing / invalid"}</dd>
          </div>)}
        </dl>
        <p className="text-sm text-muted-foreground">Saved credentials do not establish provider approval or delivery. Verification checks the funded wallet and Nigeria sender status; the owner must confirm transactional/DND approval. Verification expires after 24 hours or a settings change.</p>
        <p className="text-sm">Owner test: {activation?.testEnabled ? "Permitted for one owner service-test campaign" : "Blocked until provider verification"} · Test receipt: {activation?.receiptConfirmed ? "Owner confirmed receipt (separate from provider delivery status)" : "Not confirmed"} · Bulk broadcasts: {activation?.liveEnabled ? "Enabled" : "Disabled"}</p>
        {activation?.verifiedAt && <p className="text-xs text-muted-foreground">Last provider verification: {dateTime(activation.verifiedAt)}</p>}
        {activation?.isOwner ? <div className="flex flex-wrap gap-3">
          {([
            ["verify", "Verify provider and service approval", !setup?.ready || !setup.webhookReady],
            ["receipt", "Confirm I received the test SMS", !activation.testCampaign || !activation.testEnabled],
            ["enable", "Enable live broadcasts", !activation.testEnabled || !activation.receiptConfirmed],
            ["disable", "Disable live broadcasts", !activation.liveEnabled],
          ] as const).map(([action, label, blocked]) => <Button key={action} variant="outline" disabled={busy || blocked}
            onClick={() => { setApprovalConfirmed(false); setApprovalAction(action); }}><ShieldCheck className="h-4 w-4" />{label}</Button>)}
        </div> : <p className="text-sm text-muted-foreground">Only the designated platform owner can approve configuration, send the verification test or activate broadcasts.</p>}
      </section>
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
      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
                Essential service messages go to valid numbers unless the user turned SMS off;
                legacy accounts with no recorded SMS choice are included with a warning. Promotional
                campaigns require recorded SMS and promotional consent and respect DND restrictions.
                Service messages must not contain promotions.
              </p>
              <label className="block text-sm">
                Message body
                <Textarea
                  id="broadcast-message-body"
                  aria-label="Message body"
                  aria-invalid={Boolean(body.trim() && issue)}
                  aria-describedby={body.trim() && issue ? "broadcast-message-error" : undefined}
                  value={body}
                  maxLength={1200}
                  rows={7}
                  onChange={(e) => setBody(e.target.value)}
                  className="mt-2"
                  placeholder="PoultryPro: …"
                />
              </label>
              {body.trim() && issue && (
                <p id="broadcast-message-error" role="alert" className="text-sm text-destructive">
                  {issue}
                </p>
              )}
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
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-sm">
                <Checkbox
                  aria-label="Select All Accounts"
                  checked={mode === "all_accounts"}
                  onCheckedChange={(v) => chooseBulk("all_accounts", v === true)}
                />
                <span>
                  <span className="block font-semibold">Select All Accounts</span>
                  <span className="block text-xs text-muted-foreground">
                    Every registered account on every page ({recipients?.filtered_accounts ?? "—"}).
                    Accounts that cannot receive this SMS are listed as excluded before sending.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-sm">
                <Checkbox
                  aria-label="Select All Eligible Phone Numbers"
                  checked={mode === "all_eligible"}
                  onCheckedChange={(v) => chooseBulk("all_eligible", v === true)}
                />
                <span>
                  <span className="block font-semibold">Select All Eligible Phone Numbers</span>
                  <span className="block text-xs text-muted-foreground">
                    Only accounts that can receive this type of message (
                    {recipients?.filtered_eligible_accounts ?? "—"}).
                  </span>
                </span>
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Select-all covers all accounts matching the role and verified filters; search only
              narrows the list you see. Untick anyone to leave them out.
            </p>
            <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4" aria-live="polite">
              {[
                ["Accounts selected", recipients?.selected_accounts],
                ["With valid phone", recipients?.selected_valid_phones],
                ["Missing / invalid number", recipients?.selected_invalid_phones],
                ["Will receive SMS", recipients?.eligible],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border border-border p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-lg font-semibold">{value ?? "—"}</dd>
                </div>
              ))}
            </dl>
            {(recipients?.excluded ?? 0) > 0 && (
              <p className="text-sm">
                <strong>{recipients?.excluded} selected accounts will not be messaged:</strong>{" "}
                {Object.entries(recipients?.exclusion_reasons ?? {})
                  .map(([reason, n]) => `${reason} (${n})`)
                  .join(" · ")}
                {recipients?.duplicate_phones
                  ? ` · ${recipients.duplicate_phones} shared numbers sent once`
                  : ""}
              </p>
            )}
            {(recipients?.consent_not_recorded ?? 0) > 0 && (
              <p role="alert" className="border-l-4 border-gold bg-secondary p-3 text-sm">
                {recipients?.consent_not_recorded} selected accounts never recorded an SMS choice
                (accounts created before SMS preferences existed). They are included only because
                this is an essential service message. Use this for genuine account or service
                matters, not promotions. Their consent settings are not changed.
              </p>
            )}
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
                    disabled={mode === "all_eligible" && !row.eligible}
                    checked={isChecked(row)}
                    onCheckedChange={(v) => toggleRow(row.user_id, v === true)}
                    aria-label={`Select ${row.display_name}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold break-words">{row.display_name}</span>
                    <span className="block text-muted-foreground break-words">
                      {row.phone ?? "No valid registered number"} · {row.role_key} ·{" "}
                      {row.verified ? "Phone verified" : "Not phone-verified"} ·{" "}
                      {row.consent_status === "granted"
                        ? "SMS consent recorded"
                        : row.consent_status === "declined"
                          ? "SMS turned off"
                          : "SMS choice not recorded"}
                    </span>
                    {row.exclusion ? (
                      <span className="block text-xs text-destructive">{row.exclusion}</span>
                    ) : row.consent_warning ? (
                      <span className="block text-xs text-muted-foreground">
                        Service messages only — no recorded SMS choice
                      </span>
                    ) : null}
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
              disabled={Boolean(sendBlockReason)}
              aria-describedby={sendBlockReason ? "broadcast-send-reason" : undefined}
              onClick={() => void prepare(false)}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Now
            </Button>
            <Button
              variant="outline"
              disabled={busy || !title.trim() || Boolean(issue) || category !== "service" || !activation?.isOwner}
              onClick={() => void prepare(true)}
            >
              Send Test SMS
            </Button>
          </div>
          {sendBlockReason && (
            <p id="broadcast-send-reason" role="status" className="text-sm text-muted-foreground">
              {sendBlockReason}
            </p>
          )}
          {(!setup?.ready || !setup.liveEnabled) && (
            <p className="text-sm text-destructive">
              {overview.isError
                ? "SMS setup could not be checked. Refresh and try again."
                : !setup
                  ? "Checking SMS setup…"
                  : !setup.ready
                    ? "Actual sending is unavailable until Termii credentials and an approved sender ID are configured. You can still review a draft."
                    : "You can review a draft, but actual sending remains off until the owner approves activation."}
            </p>
          )}
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
              <p className="mt-2 text-xs text-muted-foreground">
                {Object.values((c.delivery_counts ?? {}) as Record<string, number>).reduce(
                  (sum, count) => sum + count,
                  0,
                )}{" "}
                recipients ·{" "}
                {Object.entries((c.delivery_counts ?? {}) as Record<string, number>)
                  .map(([status, count]) => `${status}: ${count}`)
                  .join(" · ")}
              </p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => {
                  setCampaignId(c.id);
                  setReportPage(0);
                  setActiveTab("reports");
                }}
              >
                View delivery results
              </Button>
              {c.status === "draft" && (
                <Button
                  className="mt-3 ml-2"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    const count = Object.values(
                      (c.delivery_counts ?? {}) as Record<string, number>,
                    ).reduce((sum, n) => sum + n, 0);
                    setDraft({
                      id: c.id,
                      count,
                      body: c.body,
                      title: c.title,
                      test: c.is_test,
                      summary: (c.audience ?? null) as Record<string, unknown> | null,
                    });
                    setConfirmed(false);
                  }}
                >
                  Review draft
                </Button>
              )}
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
              <Button
                variant="outline"
                disabled={
                  busy ||
                  !setup?.liveEnabled ||
                  !["failed", "partially_failed", "completed"].includes(
                    activeCampaign?.status ?? "",
                  )
                }
                onClick={() => setRetryConfirm(true)}
              >
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
          <DraftSummary draft={draft} />
          <p className="text-xs text-muted-foreground">
            Estimated cost unavailable. Termii will charge according to your account rates.
          </p>
          {!draftCanSend ? (
            <p role="alert" className="text-sm text-destructive">
              {draft?.test ? "Test sending blocked: the owner must verify Termii configuration, funding, sender ID and service-route approval first."
                : "Live broadcast blocked: verify Termii, confirm receipt of the owner test, then explicitly enable live broadcasts."} This remains a draft.
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
              disabled={!confirmed || busy || !draftCanSend}
              onClick={() => void confirm()}
            >
              <Send className="h-4 w-4" />
              Confirm and send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(approvalAction)} onOpenChange={(open) => { if (!open && !busy) setApprovalAction(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm SMS {approvalAction === "verify" ? "verification" : approvalAction === "receipt" ? "test receipt" : approvalAction === "enable" ? "activation" : "deactivation"}</DialogTitle>
            <DialogDescription>This updates owner approval only. It does not send a message or publish the website.</DialogDescription></DialogHeader>
          <p className="text-sm">{approvalAction === "verify" ? "Confirm Termii has approved this sender and your essential transactional/DND use. A registered phone is not promotional consent. Account checks will verify funding and Nigeria sender status."
            : approvalAction === "receipt" ? "Confirm you personally received the SMS from the authorised owner test. This records your receipt confirmation; it does not overwrite the provider's delivery status."
            : approvalAction === "enable" ? "Enable separately confirmed broadcasts to eligible recipients. Existing consent, phone validity, deduplication and campaign confirmation checks still apply."
            : "Stop further SMS submissions. Messages already submitted cannot be recalled."}</p>
          <label className="flex items-start gap-2 text-sm"><Checkbox checked={approvalConfirmed} onCheckedChange={(v) => setApprovalConfirmed(v === true)} />I confirm this owner approval action.</label>
          <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setApprovalAction(null)}>Cancel</Button>
            <Button disabled={busy || !approvalConfirmed} onClick={() => void applyApproval()}>Confirm approval</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={retryConfirm} onOpenChange={setRetryConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm safe retry</DialogTitle>
            <DialogDescription>
              Only explicit provider rejections without a message reference can be retried, with a
              maximum of three attempts. Delivered, accepted, failed-after-acceptance and unknown
              submissions are excluded.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            Campaign: {activeCampaign?.title} · Consent will be checked again before sending.
            Additional provider charges may apply.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetryConfirm(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !campaignId || !setup?.liveEnabled}
              onClick={async () => {
                if (!campaignId) return;
                setBusy(true);
                try {
                  await retryFn({ data: { id: campaignId, confirmed: true } });
                  setRetryConfirm(false);
                  setBusy(false);
                  await runQueue(campaignId);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Retry unavailable");
                  setBusy(false);
                }
              }}
            >
              Confirm retry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DraftSummary({
  draft,
}: {
  draft: { count: number; body: string; summary: Record<string, unknown> | null } | null;
}) {
  if (!draft) return null;
  const s = draft.summary ?? {};
  const num = (k: string) => (typeof s[k] === "number" ? (s[k] as number) : null);
  const reasons = (s.exclusion_reasons ?? {}) as Record<string, number>;
  const segments = smsMetrics(draft.body).segments;
  return (
    <div className="space-y-2 text-sm">
      <dl className="grid grid-cols-2 gap-2">
        <dt className="text-muted-foreground">Accounts selected</dt>
        <dd className="font-semibold">{num("selected_accounts") ?? "—"}</dd>
        <dt className="text-muted-foreground">With valid phone numbers</dt>
        <dd className="font-semibold">{num("valid_phones") ?? "—"}</dd>
        <dt className="text-muted-foreground">Eligible recipients (will be queued)</dt>
        <dd className="font-semibold">{draft.count}</dd>
        <dt className="text-muted-foreground">Excluded accounts</dt>
        <dd className="font-semibold">{num("excluded") ?? "—"}</dd>
        {num("selected_accounts") != null && num("excluded") != null && (
          <>
            <dt className="text-muted-foreground">Shared numbers sent once</dt>
            <dd className="font-semibold">
              {Math.max(0, (num("selected_accounts") ?? 0) - (num("excluded") ?? 0) - draft.count)}
            </dd>
          </>
        )}
        <dt className="text-muted-foreground">Estimated SMS units</dt>
        <dd className="font-semibold">
          {segments * draft.count} ({segments} per recipient)
        </dd>
      </dl>
      {Object.keys(reasons).length > 0 && (
        <ul className="list-disc pl-5 text-xs text-muted-foreground">
          {Object.entries(reasons).map(([reason, n]) => (
            <li key={reason}>
              {reason}: {n}
            </li>
          ))}
        </ul>
      )}
      {(num("consent_not_recorded") ?? 0) > 0 && (
        <p className="border-l-4 border-gold bg-secondary p-2 text-xs">
          {num("consent_not_recorded")} eligible accounts have no recorded SMS choice and are
          included only for this essential service message.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Being queued does not mean delivered. Delivery results appear per recipient in reports.
      </p>
    </div>
  );
}
