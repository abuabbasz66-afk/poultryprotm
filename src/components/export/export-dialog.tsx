import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText, Loader2, Table2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFarm, useFarmId, useRooms } from "@/lib/farm-data";
import { usePermissions } from "@/lib/rbac";
import { EXPORT_DESCRIPTORS, DESCRIPTOR_BY_KEY, SECTION_PRESETS } from "@/lib/export/registry";
import { descriptorHasData } from "@/lib/export/fetch";
import { RANGE_OPTIONS, rangeText, resolveRange, type RangeKey } from "@/lib/export/range";
import { STEP_LABELS, useRecordExport, type ExportFormat } from "@/lib/export/use-export";

type Scope = "section" | "farm" | "selected";

const FORMATS: { key: ExportFormat; label: string; hint: string; icon: typeof FileText }[] = [
  { key: "pdf", label: "PDF", hint: "Professional report for sharing and printing.", icon: FileText },
  { key: "excel", label: "Excel", hint: "Detailed workbook for analysis.", icon: FileSpreadsheet },
  { key: "csv", label: "CSV", hint: "Raw records for data processing.", icon: Table2 },
];

export function ExportDialog({
  open,
  onOpenChange,
  section,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Key into SECTION_PRESETS — the page the user opened the dialog from. */
  section: keyof typeof SECTION_PRESETS | string;
}) {
  const preset = SECTION_PRESETS[section] ?? { label: "Farm Records", keys: [] };
  const { data: farmId } = useFarmId();
  const { data: farm } = useFarm();
  const { data: rooms } = useRooms();
  const { can } = usePermissions();
  const { run, step, detail, error, reset } = useRecordExport();

  const [scope, setScope] = useState<Scope>("section");
  const [rangeKey, setRangeKey] = useState<RangeKey>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [roomId, setRoomId] = useState("all");
  const [batchId, setBatchId] = useState("all");
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [selected, setSelected] = useState<string[]>(preset.keys);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      reset();
      setScope("section");
      setSelected(preset.keys);
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, section]);

  /** Record types the user may read AND that actually hold records. */
  const availability = useQuery({
    queryKey: ["export", "availability", farmId],
    enabled: !!farmId && open,
    staleTime: 60_000,
    queryFn: async () => {
      const allowed = EXPORT_DESCRIPTORS.filter((d) => can(d.permission));
      const results = await Promise.all(
        allowed.map(async (d) => ({ key: d.key, ok: await descriptorHasData(d, farmId!) })),
      );
      return results.filter((r) => r.ok).map((r) => r.key);
    },
  });

  const flocks = useQuery({
    queryKey: ["export", "flocks", farmId],
    enabled: !!farmId && open,
    staleTime: 60_000,
    queryFn: async () => {
      const [layers, broilers] = await Promise.all([
        supabase.from("layer_batches").select("id,name").eq("farm_id", farmId!),
        supabase.from("broiler_batches").select("id,name").eq("farm_id", farmId!),
      ]);
      return [...(layers.data ?? []), ...(broilers.data ?? [])] as { id: string; name: string }[];
    },
  });

  const availableKeys = availability.data ?? [];
  const sectionKeys = useMemo(
    () => preset.keys.filter((k) => availableKeys.includes(k)),
    [preset.keys, availableKeys],
  );

  const activeKeys =
    scope === "section" ? sectionKeys : scope === "farm" ? availableKeys : selected.filter((k) => availableKeys.includes(k));

  const range = resolveRange(rangeKey, { from: customFrom, to: customTo });
  const supportsRoom = activeKeys.some((k) => DESCRIPTOR_BY_KEY[k]?.roomField);
  const supportsFlock = activeKeys.some((k) => DESCRIPTOR_BY_KEY[k]?.batchField);

  const toggle = (key: string) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const start = async () => {
    if (!activeKeys.length) {
      toast.error("Choose at least one record type with data.");
      return;
    }
    if (rangeKey === "custom" && (!customFrom || !customTo)) {
      toast.error("Pick both a start and an end date.");
      return;
    }
    setBusy(true);
    try {
      const title =
        scope === "farm"
          ? "Complete Farm Report"
          : scope === "section"
            ? preset.label
            : "Selected Farm Records";
      const token = scope === "farm" ? "Farm" : scope === "section" ? preset.label.split(" ")[0] : "Records";
      const result = await run({
        title,
        fileToken: token,
        keys: activeKeys,
        format,
        range,
        scopeLabel: scope,
        roomId: roomId === "all" ? null : roomId,
        roomName:
          roomId === "all" ? null : (rooms ?? []).find((r) => r.id === roomId)?.name ?? null,
        batchId: batchId === "all" ? null : batchId,
      });
      toast.success(
        result.totalRows
          ? `Your report is ready — ${result.totalRows.toLocaleString()} records.`
          : "Your report is ready.",
      );
    } catch {
      toast.error("Could not generate the report.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export PoultryPro Records</DialogTitle>
          <DialogDescription>
            Download your farm records for analysis, reporting or backup.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>What to export</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["section", preset.label],
                  ["farm", "Entire farm"],
                  ["selected", "Selected records"],
                ] as [Scope, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setScope(key)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                    scope === key
                      ? "border-primary bg-primary/5 font-medium text-foreground"
                      : "border-border text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {scope !== "section" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Record types</Label>
                {scope === "selected" && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setSelected(availableKeys)}>
                      Select all
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                      Clear all
                    </Button>
                  </div>
                )}
              </div>
              {availability.isPending ? (
                <p className="text-sm text-muted-foreground">Checking which records you have…</p>
              ) : availableKeys.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  You do not have any records to export yet.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {availableKeys.map((key) => {
                    const desc = DESCRIPTOR_BY_KEY[key];
                    const checked = scope === "farm" || selected.includes(key);
                    return (
                      <label
                        key={key}
                        className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          disabled={scope === "farm"}
                          onCheckedChange={() => toggle(key)}
                        />
                        <span>{desc.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Date range</Label>
              <Select value={rangeKey} onValueChange={(v) => setRangeKey(v as RangeKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RANGE_OPTIONS.map((o) => (
                    <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Farm</Label>
              <Select value="current" onValueChange={() => undefined}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">{farm?.name ?? "Your farm"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {rangeKey === "custom" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="exp-from">From</Label>
                <Input id="exp-from" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-to">To</Label>
                <Input id="exp-to" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </div>
          )}

          {(supportsRoom || supportsFlock) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {supportsRoom && (
                <div className="space-y-2">
                  <Label>Room</Label>
                  <Select value={roomId} onValueChange={setRoomId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All rooms</SelectItem>
                      {(rooms ?? []).map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {supportsFlock && (
                <div className="space-y-2">
                  <Label>Flock</Label>
                  <Select value={batchId} onValueChange={setBatchId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All flocks</SelectItem>
                      {(flocks.data ?? []).map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Format</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {FORMATS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFormat(f.key)}
                  className={`rounded-xl border p-3 text-left transition ${
                    format === f.key
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-foreground/30"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <f.icon className="h-4 w-4" /> {f.label}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{f.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Reporting period: {rangeText(range)} · {activeKeys.length} record type
            {activeKeys.length === 1 ? "" : "s"}
          </p>

          {busy || step > 0 ? (
            <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
              <Progress value={(step / 4) * 100} />
              <p className="text-xs text-muted-foreground">
                Step {Math.max(step, 1)} of 4 — {STEP_LABELS[Math.max(step, 1)]}
                {detail ? ` · ${detail}` : ""}
              </p>
            </div>
          ) : null}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            <Button onClick={start} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {busy ? "Preparing export…" : "Export records"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
