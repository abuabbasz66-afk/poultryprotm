import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Upload, FileText, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRooms } from "@/lib/farm-data";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({ meta: [{ title: "Import Farm Records — PoultryPro" }] }),
  component: ImportPage,
});

// ------------ CSV parser (RFC-4180-ish) ------------
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQ = false;
  const src = text.replace(/^\uFEFF/, "");
  while (i < src.length) {
    const c = src[i];
    if (inQ) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      cell += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ",") { row.push(cell); cell = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; continue; }
    cell += c; i++;
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ""));
}

// ISO date normaliser — accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, D Mon YYYY
function normDate(s: string): string | null {
  const v = (s || "").trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(v + "T00:00:00");
    return isNaN(d.getTime()) ? null : v;
  }
  const dmy = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const yy = y.length === 2 ? "20" + y : y;
    const iso = `${yy}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    const dt = new Date(iso + "T00:00:00");
    return isNaN(dt.getTime()) ? null : iso;
  }
  const dt = new Date(v);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return null;
}
function shortLabel(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function num(v: string): number | null {
  const s = (v || "").toString().trim().replace(/,/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function intNonNeg(v: string): number | null {
  const n = num(v);
  if (n === null) return null;
  if (n < 0 || !Number.isInteger(n)) return null;
  return n;
}

// ------------ Types ------------
type Kind = "egg" | "feed" | "mortality" | "health" | "rooms";

type PreviewRow = {
  line: number;
  status: "ok" | "duplicate" | "error";
  message?: string;
  data: Record<string, any>;
  raw: string[];
};

const SPECS: Record<Kind, {
  label: string;
  columns: string[];
  example: string[][];
  description: string;
}> = {
  egg: {
    label: "Egg Production",
    description: "One row per date. Values are crates per room (whole numbers).",
    columns: ["date", "room2_crates", "room3_crates", "room4_crates", "extra"],
    example: [
      ["2026-02-19", "42", "38", "40", "3"],
      ["2026-02-20", "45", "40", "41", "0"],
    ],
  },
  feed: {
    label: "Feed Usage",
    description: "One row per room per date. Bags consumed on that date.",
    columns: ["date", "room", "bags"],
    example: [
      ["2026-02-19", "ROOM 2", "6"],
      ["2026-02-19", "ROOM 3", "7"],
      ["2026-02-19", "ROOM 4", "6"],
    ],
  },
  mortality: {
    label: "Mortality",
    description: "One row per mortality event. Room must match an existing room name.",
    columns: ["date", "room", "loss", "cause"],
    example: [
      ["2026-02-19", "ROOM 3", "2", "Heat stress"],
      ["2026-02-20", "ROOM 4", "1", "Unknown"],
    ],
  },
  health: {
    label: "Health Records",
    description: "Vaccination/vitamin/observation records. Scope is a room name or 'All Rooms'.",
    columns: ["date", "name", "scope", "type"],
    example: [
      ["2026-02-15", "Newcastle Vaccine", "All Rooms", "Vaccination"],
      ["2026-02-18", "Multivitamin", "ROOM 2", "Vitamin"],
    ],
  },
  rooms: {
    label: "Room Populations",
    description: "Set the initial and current bird count per room. Matching rooms are updated; new room names are created.",
    columns: ["room", "initial", "current"],
    example: [
      ["ROOM 2", "500", "492"],
      ["ROOM 3", "500", "488"],
      ["ROOM 4", "500", "495"],
    ],
  },
};

function toCSV(rows: string[][]): string {
  return rows.map(r => r.map(c => /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(",")).join("\n");
}

const FILENAMES: Record<Kind, string> = {
  egg: "poultrypro_egg_production_template.csv",
  feed: "poultrypro_feed_usage_template.csv",
  mortality: "poultrypro_mortality_template.csv",
  health: "poultrypro_health_records_template.csv",
  rooms: "poultrypro_room_populations_template.csv",
};

function downloadTemplate(kind: Kind) {
  const spec = SPECS[kind];
  // Prepend BOM so Excel opens UTF-8 correctly; CRLF for cross-platform.
  const csv = "\uFEFF" + toCSV([spec.columns, ...spec.example]).replace(/\n/g, "\r\n") + "\r\n";
  const filename = FILENAMES[kind];
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });

  // Legacy IE / old Edge
  const navAny = navigator as any;
  if (navAny.msSaveOrOpenBlob) {
    navAny.msSaveOrOpenBlob(blob, filename);
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.target = "_self";
  // Some mobile browsers require the anchor to be in the DOM before click().
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  // Delay removal + revoke so mobile Chrome/Safari can start the download.
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

// ------------ Component ------------
function ImportPage() {
  const qc = useQueryClient();
  const roomsQ = useRooms();
  const rooms = roomsQ.data ?? [];
  const roomNames = useMemo(() => new Set(rooms.map(r => r.name.toUpperCase())), [rooms]);

  const [kind, setKind] = useState<Kind>("egg");
  const [fileName, setFileName] = useState<string>("");
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; failed: number; errors: string[] } | null>(null);

  const spec = SPECS[kind];

  async function handleFile(file: File) {
    setResult(null);
    setPreview(null);
    setFileName(file.name);
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length === 0) { setPreview([]); return; }
    const header = rows[0].map(h => h.trim().toLowerCase());
    const expected = spec.columns.map(c => c.toLowerCase());
    const missing = expected.filter(c => !header.includes(c));
    if (missing.length) {
      setPreview([{
        line: 1, status: "error",
        message: `Missing required columns: ${missing.join(", ")}. Expected: ${spec.columns.join(", ")}`,
        data: {}, raw: rows[0],
      }]);
      return;
    }
    const idx: Record<string, number> = {};
    expected.forEach(c => { idx[c] = header.indexOf(c); });

    // Load existing records for duplicate detection
    const existing = await loadExisting(kind);

    const out: PreviewRow[] = [];
    const seenInFile = new Set<string>();
    for (let r = 1; r < rows.length; r++) {
      const raw = rows[r];
      const get = (c: string) => (raw[idx[c]] ?? "").trim();
      const line = r + 1;
      try {
        const parsed = validateRow(kind, get, roomNames);
        if (parsed.error) { out.push({ line, status: "error", message: parsed.error, data: {}, raw }); continue; }
        const key = dedupeKey(kind, parsed.data);
        if (seenInFile.has(key)) { out.push({ line, status: "duplicate", message: "Duplicate row within file", data: parsed.data, raw }); continue; }
        seenInFile.add(key);
        if (existing.has(key)) { out.push({ line, status: "duplicate", message: "Already exists in database", data: parsed.data, raw }); continue; }
        out.push({ line, status: "ok", data: parsed.data, raw });
      } catch (e: any) {
        out.push({ line, status: "error", message: e?.message ?? "Parse error", data: {}, raw });
      }
    }
    setPreview(out);
  }

  async function runImport() {
    if (!preview) return;
    const okRows = preview.filter(p => p.status === "ok");
    if (okRows.length === 0) return;
    setBusy(true);
    const { data: farmRow, error: farmErr } = await supabase.from("farms").select("id").limit(1).maybeSingle();
    if (farmErr || !farmRow?.id) {
      setBusy(false);
      setResult({ imported: 0, skipped: 0, failed: okRows.length, errors: ["No farm found for this account."] });
      return;
    }
    const farm_id = farmRow.id;

    let imported = 0;
    const errors: string[] = [];
    const skipped = preview.filter(p => p.status === "duplicate").length;
    let failed = preview.filter(p => p.status === "error").length;

    for (const row of okRows) {
      try {
        await insertRow(kind, farm_id, row.data);
        imported++;
      } catch (e: any) {
        failed++;
        errors.push(`Line ${row.line}: ${e?.message ?? "insert failed"}`);
      }
    }

    // Invalidate all farm caches so Analytics + AI Intelligence recompute
    qc.invalidateQueries();
    setBusy(false);
    setResult({ imported, skipped, failed, errors });
    setPreview(null);
  }

  const counts = useMemo(() => {
    if (!preview) return null;
    return {
      ok: preview.filter(p => p.status === "ok").length,
      dup: preview.filter(p => p.status === "duplicate").length,
      err: preview.filter(p => p.status === "error").length,
    };
  }, [preview]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      <header className="bg-[color:var(--forest)] text-primary-foreground">
        <div className="container-x flex items-center justify-between py-4">
          <Link to="/_authenticated/dashboard" className="inline-flex items-center gap-2 text-sm text-primary-foreground/80 hover:text-primary-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
          <span className="text-sm font-display font-semibold">Import Historical Records</span>
        </div>
        <div className="container-x pb-8 pt-2">
          <h1 className="font-display text-2xl md:text-3xl font-semibold">CSV Import</h1>
          <p className="mt-2 text-sm text-primary-foreground/80 max-w-2xl">
            Upload historical farm records to this authenticated farm. Records are matched to your farm ID and rooms by name. Duplicates are detected and skipped automatically.
          </p>
        </div>
      </header>

      <main className="container-x -mt-4 space-y-6">
        {/* Record type picker */}
        <div className="rounded-3xl bg-card border border-border p-2">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5">
            {(Object.keys(SPECS) as Kind[]).map(k => (
              <button
                key={k}
                onClick={() => { setKind(k); setPreview(null); setResult(null); setFileName(""); }}
                className={
                  "rounded-2xl px-3 py-2.5 text-sm font-medium transition " +
                  (kind === k
                    ? "bg-[color:var(--forest)] text-primary-foreground shadow"
                    : "text-foreground hover:bg-secondary")
                }
              >
                {SPECS[k].label}
              </button>
            ))}
          </div>
        </div>

        {/* Spec + template */}
        <section className="rounded-3xl bg-card border border-border p-5 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-display text-lg font-semibold">{spec.label}</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{spec.description}</p>
            </div>
            <button
              onClick={() => downloadTemplate(kind)}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-secondary"
            >
              <Download className="h-4 w-4" /> Download template
            </button>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Required columns (in any order)</div>
            <div className="flex flex-wrap gap-1.5">
              {spec.columns.map(c => (
                <code key={c} className="rounded-md bg-secondary px-2 py-0.5 text-xs">{c}</code>
              ))}
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Dates accept <code>YYYY-MM-DD</code>, <code>DD/MM/YYYY</code> or <code>DD-MM-YYYY</code>.
              Room names must match existing rooms in your farm (case-insensitive), except when importing the Room Populations template.
            </div>
          </div>
        </section>

        {/* File upload */}
        <section className="rounded-3xl bg-card border border-border p-5 space-y-3">
          <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-8 cursor-pointer hover:bg-secondary/40 transition">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium">Choose CSV file</span>
            <span className="text-xs text-muted-foreground">Preview will appear before anything is saved</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
          {fileName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" /> {fileName}
            </div>
          )}
        </section>

        {/* Preview */}
        {preview && (
          <section className="rounded-3xl bg-card border border-border p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="font-display text-lg font-semibold">Preview</h2>
                <p className="text-xs text-muted-foreground">Nothing is saved yet. Review before importing.</p>
              </div>
              {counts && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="inline-flex items-center gap-1 text-[color:var(--forest)]">
                    <CheckCircle2 className="h-4 w-4" /> {counts.ok} ready
                  </span>
                  <span className="inline-flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="h-4 w-4" /> {counts.dup} duplicate
                  </span>
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <XCircle className="h-4 w-4" /> {counts.err} error
                  </span>
                </div>
              )}
            </div>

            <div className="overflow-x-auto max-h-[420px] overflow-y-auto border border-border rounded-xl">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-secondary">
                  <tr className="text-left">
                    <th className="py-2 px-3 font-medium">Line</th>
                    <th className="py-2 px-3 font-medium">Status</th>
                    {spec.columns.map(c => <th key={c} className="py-2 px-3 font-medium">{c}</th>)}
                    <th className="py-2 px-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 500).map((p, i) => (
                    <tr key={i} className="border-t border-border/60">
                      <td className="py-1.5 px-3 text-muted-foreground">{p.line}</td>
                      <td className="py-1.5 px-3">
                        {p.status === "ok" && <span className="inline-flex items-center gap-1 text-[color:var(--forest)]"><CheckCircle2 className="h-3.5 w-3.5" /> ok</span>}
                        {p.status === "duplicate" && <span className="inline-flex items-center gap-1 text-amber-600"><AlertTriangle className="h-3.5 w-3.5" /> skip</span>}
                        {p.status === "error" && <span className="inline-flex items-center gap-1 text-destructive"><XCircle className="h-3.5 w-3.5" /> error</span>}
                      </td>
                      {spec.columns.map(c => (
                        <td key={c} className="py-1.5 px-3">{String(p.data[c] ?? "")}</td>
                      ))}
                      <td className="py-1.5 px-3 text-muted-foreground">{p.message ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 500 && (
                <div className="p-2 text-center text-xs text-muted-foreground">
                  Showing first 500 of {preview.length} rows — all will be processed on import.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => { setPreview(null); setFileName(""); }}
                className="rounded-full border border-border px-4 py-2 text-sm hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                disabled={busy || !counts || counts.ok === 0}
                onClick={runImport}
                className="rounded-full bg-[color:var(--forest)] text-primary-foreground px-5 py-2 text-sm font-medium disabled:opacity-50"
              >
                {busy ? "Importing…" : `Import ${counts?.ok ?? 0} record${counts?.ok === 1 ? "" : "s"}`}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Existing records will not be deleted or overwritten. Duplicate rows are skipped.
            </p>
          </section>
        )}

        {/* Result */}
        {result && (
          <section className="rounded-3xl bg-card border border-border p-5 space-y-3">
            <h2 className="font-display text-lg font-semibold">Import complete</h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-[color:var(--forest)]/10 p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Imported</div>
                <div className="text-2xl font-semibold text-[color:var(--forest)]">{result.imported}</div>
              </div>
              <div className="rounded-2xl bg-amber-500/10 p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Skipped</div>
                <div className="text-2xl font-semibold text-amber-700">{result.skipped}</div>
              </div>
              <div className="rounded-2xl bg-destructive/10 p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Failed</div>
                <div className="text-2xl font-semibold text-destructive">{result.failed}</div>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="mt-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Errors</div>
                <ul className="text-xs text-destructive space-y-0.5 max-h-40 overflow-auto">
                  {result.errors.slice(0, 50).map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </div>
            )}
            <div className="pt-2">
              <Link to="/_authenticated/dashboard" className="inline-flex items-center gap-2 text-sm text-[color:var(--forest)] hover:underline">
                <ArrowLeft className="h-4 w-4" /> Return to dashboard — Analytics and AI Intelligence will reflect the new records
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

// ------------ Validation per record type ------------
function validateRow(
  kind: Kind,
  get: (c: string) => string,
  roomNames: Set<string>,
): { data: Record<string, any>; error?: string } {
  if (kind === "egg") {
    const date = normDate(get("date"));
    if (!date) return { data: {}, error: "Invalid or missing date" };
    const r2 = intNonNeg(get("room2_crates"));
    const r3 = intNonNeg(get("room3_crates"));
    const r4 = intNonNeg(get("room4_crates"));
    const extra = get("extra") === "" ? 0 : intNonNeg(get("extra"));
    if (r2 === null || r3 === null || r4 === null || extra === null) return { data: {}, error: "Crate values must be non-negative integers" };
    return { data: { date, room2_crates: r2, room3_crates: r3, room4_crates: r4, extra } };
  }
  if (kind === "feed") {
    const date = normDate(get("date"));
    if (!date) return { data: {}, error: "Invalid or missing date" };
    const room = get("room").toUpperCase();
    if (!room) return { data: {}, error: "Missing room" };
    if (!roomNames.has(room)) return { data: {}, error: `Room "${room}" not found in this farm` };
    const bags = num(get("bags"));
    if (bags === null || bags < 0) return { data: {}, error: "Bags must be a non-negative number" };
    return { data: { date, room, bags } };
  }
  if (kind === "mortality") {
    const date = normDate(get("date"));
    if (!date) return { data: {}, error: "Invalid or missing date" };
    const room = get("room").toUpperCase();
    if (!roomNames.has(room)) return { data: {}, error: `Room "${room}" not found in this farm` };
    const loss = intNonNeg(get("loss"));
    if (loss === null || loss === 0) return { data: {}, error: "Loss must be a positive integer" };
    const cause = get("cause") || "Unknown";
    return { data: { date, room, loss, cause } };
  }
  if (kind === "health") {
    const date = normDate(get("date"));
    if (!date) return { data: {}, error: "Invalid or missing date" };
    const name = get("name");
    if (!name) return { data: {}, error: "Missing name" };
    const scope = get("scope") || "All Rooms";
    if (scope.toLowerCase() !== "all rooms" && !roomNames.has(scope.toUpperCase())) {
      return { data: {}, error: `Scope must be "All Rooms" or an existing room name (got "${scope}")` };
    }
    const scopeNorm = scope.toLowerCase() === "all rooms" ? "All Rooms" : scope.toUpperCase();
    const type = get("type");
    if (type !== "Vaccination" && type !== "Vitamin") return { data: {}, error: "Type must be 'Vaccination' or 'Vitamin'" };
    return { data: { date, name, scope: scopeNorm, type } };
  }
  if (kind === "rooms") {
    const room = get("room").toUpperCase();
    if (!room) return { data: {}, error: "Missing room" };
    const initial = intNonNeg(get("initial"));
    const current = intNonNeg(get("current"));
    if (initial === null || current === null) return { data: {}, error: "Initial and current must be non-negative integers" };
    if (current > initial) return { data: {}, error: "Current cannot exceed initial" };
    return { data: { room, initial, current } };
  }
  return { data: {}, error: "Unknown record type" };
}

function dedupeKey(kind: Kind, d: Record<string, any>): string {
  if (kind === "egg") return `egg|${d.date}`;
  if (kind === "feed") return `feed|${d.date}|${d.room}`;
  if (kind === "mortality") return `mort|${d.date}|${d.room}|${d.cause}|${d.loss}`;
  if (kind === "health") return `hlth|${d.date}|${d.name}|${d.scope}|${d.type}`;
  if (kind === "rooms") return `room|${d.room}`;
  return JSON.stringify(d);
}

async function loadExisting(kind: Kind): Promise<Set<string>> {
  const set = new Set<string>();
  if (kind === "egg") {
    const { data } = await supabase.from("egg_production").select("date");
    (data ?? []).forEach(r => set.add(`egg|${r.date}`));
  } else if (kind === "feed") {
    const { data } = await supabase.from("feed_usage").select("date, room, bags");
    (data ?? []).forEach(r => set.add(`feed|${r.date}|${(r.room || "").toUpperCase()}`));
  } else if (kind === "mortality") {
    const { data } = await supabase.from("mortality").select("date, room, cause, loss");
    (data ?? []).forEach(r => set.add(`mort|${r.date}|${(r.room || "").toUpperCase()}|${r.cause}|${r.loss}`));
  } else if (kind === "health") {
    const { data } = await supabase.from("health_records").select("date, name, scope, type");
    (data ?? []).forEach(r => set.add(`hlth|${r.date}|${r.name}|${r.scope}|${r.type}`));
  } else if (kind === "rooms") {
    // Rooms are upserted by name — do not mark as duplicate; existing rows are updated.
  }
  return set;
}

async function insertRow(kind: Kind, farm_id: string, d: Record<string, any>) {
  if (kind === "egg") {
    const { error } = await supabase.from("egg_production").insert({
      farm_id,
      date: d.date,
      label: shortLabel(d.date),
      r2: d.room2_crates,
      r3: d.room3_crates,
      r4: d.room4_crates,
      extra: d.extra,
    });
    if (error) throw error;
  } else if (kind === "feed") {
    const { error } = await supabase.from("feed_usage").insert({
      farm_id, date: d.date, room: d.room, bags: d.bags,
    });
    if (error) throw error;
  } else if (kind === "mortality") {
    const { error } = await supabase.from("mortality").insert({
      farm_id, date: d.date, room: d.room, loss: d.loss, cause: d.cause,
    });
    if (error) throw error;
    // Decrement room current
    const { data: rm } = await supabase.from("rooms").select("id,current").eq("farm_id", farm_id).eq("name", d.room).maybeSingle();
    if (rm) {
      await supabase.from("rooms").update({ current: Math.max(0, (rm.current ?? 0) - d.loss) }).eq("id", rm.id);
    }
  } else if (kind === "health") {
    const { error } = await supabase.from("health_records").insert({
      farm_id, date: d.date, name: d.name, scope: d.scope, type: d.type,
    });
    if (error) throw error;
  } else if (kind === "rooms") {
    const { data: existing } = await supabase.from("rooms").select("id").eq("farm_id", farm_id).eq("name", d.room).maybeSingle();
    if (existing?.id) {
      const { error } = await supabase.from("rooms").update({ initial: d.initial, current: d.current }).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("rooms").insert({ farm_id, name: d.room, initial: d.initial, current: d.current });
      if (error) throw error;
    }
  }
}
