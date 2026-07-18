import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type WhatsAppStats = {
  total: number;
  today: number;
  last_7_days: number;
  last_30_days: number;
  total_visits: number;
  conversion_rate: number;
  top_pages: Array<{ page: string; clicks: number }>;
  devices: Array<{ device: string; clicks: number }>;
  sources: Array<{ source: string; clicks: number }>;
  user_types: Array<{ user_type: string; clicks: number }>;
  browsers: Array<{ browser: string; clicks: number }>;
  countries: Array<{ country: string; clicks: number }>;
  daily_trend: Array<{ date: string; clicks: number }>;
};

export type WhatsAppClickRow = {
  id: string;
  created_at: string;
  page_path: string | null;
  page_label: string | null;
  user_type: string;
  user_id: string | null;
  device_type: string | null;
  browser: string | null;
  country: string | null;
  city: string | null;
  referrer: string | null;
  referrer_source: string | null;
  session_id: string | null;
  user_agent: string | null;
};

export function useWhatsAppStats(userId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["admin", userId ?? "anon", "whatsapp-stats"],
    enabled,
    refetchInterval: 60_000,
    queryFn: async (): Promise<WhatsAppStats> => {
      const { data, error } = await supabase.rpc("admin_whatsapp_stats");
      if (error) throw error;
      return data as WhatsAppStats;
    },
  });
}

export function useWhatsAppRecent(userId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["admin", userId ?? "anon", "whatsapp-recent"],
    enabled,
    refetchInterval: 30_000,
    queryFn: async (): Promise<WhatsAppClickRow[]> => {
      const { data, error } = await supabase.rpc("admin_whatsapp_recent", { _limit: 100 });
      if (error) throw error;
      return (data ?? []) as WhatsAppClickRow[];
    },
  });
}

export async function fetchWhatsAppExport(): Promise<WhatsAppClickRow[]> {
  const { data, error } = await supabase.rpc("admin_whatsapp_export");
  if (error) throw error;
  return (data ?? []) as WhatsAppClickRow[];
}

// ---------- Export helpers (browser-safe, no extra deps) ----------

const CSV_COLS: Array<{ key: keyof WhatsAppClickRow; label: string }> = [
  { key: "created_at", label: "Timestamp" },
  { key: "page_label", label: "Page" },
  { key: "page_path", label: "Path" },
  { key: "user_type", label: "User type" },
  { key: "device_type", label: "Device" },
  { key: "browser", label: "Browser" },
  { key: "country", label: "Country" },
  { key: "city", label: "City" },
  { key: "referrer_source", label: "Source" },
  { key: "referrer", label: "Referrer" },
  { key: "session_id", label: "Session" },
];

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadCsv(rows: WhatsAppClickRow[]) {
  const header = CSV_COLS.map((c) => c.label).join(",");
  const body = rows
    .map((r) => CSV_COLS.map((c) => csvEscape(r[c.key])).join(","))
    .join("\n");
  const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `whatsapp-enquiries-${dateStamp()}.csv`);
}

export function downloadPdf(rows: WhatsAppClickRow[], summary: WhatsAppStats | undefined) {
  // Use the browser's print-to-PDF dialog: no dependency, works everywhere.
  const win = window.open("", "_blank", "width=1024,height=768");
  if (!win) return;
  const total = summary?.total ?? rows.length;
  const today = summary?.today ?? "—";
  const week = summary?.last_7_days ?? "—";
  const month = summary?.last_30_days ?? "—";
  const conv = summary?.conversion_rate != null ? `${summary.conversion_rate}%` : "—";

  const rowsHtml = rows
    .slice(0, 500)
    .map(
      (r) => `<tr>
        <td>${escapeHtml(new Date(r.created_at).toLocaleString())}</td>
        <td>${escapeHtml(r.page_label ?? "—")}</td>
        <td>${escapeHtml(r.user_type ?? "—")}</td>
        <td>${escapeHtml(r.device_type ?? "—")}</td>
        <td>${escapeHtml(r.browser ?? "—")}</td>
        <td>${escapeHtml(r.country ?? "—")}</td>
        <td>${escapeHtml(r.referrer_source ?? "Direct")}</td>
      </tr>`,
    )
    .join("");

  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>PoultryPro — WhatsApp Enquiries</title>
    <style>
      body{font-family:Inter,system-ui,sans-serif;padding:24px;color:#12281c}
      h1{margin:0 0 4px;font-size:20px}
      .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:18px 0}
      .kpi{border:1px solid #e5e7eb;border-radius:10px;padding:10px}
      .kpi small{color:#6b7280;text-transform:uppercase;font-size:10px;letter-spacing:.1em}
      .kpi b{display:block;font-size:20px;margin-top:4px}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
      th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #eef1ee}
      th{background:#f6f2e6;text-transform:uppercase;font-size:10px;letter-spacing:.08em}
      @media print { .noprint{display:none} }
    </style></head><body>
    <h1>PoultryPro™ — WhatsApp Enquiries Report</h1>
    <div style="color:#6b7280;font-size:12px">Generated ${new Date().toLocaleString()}</div>
    <div class="kpis">
      <div class="kpi"><small>Total</small><b>${total}</b></div>
      <div class="kpi"><small>Today</small><b>${today}</b></div>
      <div class="kpi"><small>Last 7 days</small><b>${week}</b></div>
      <div class="kpi"><small>Last 30 days</small><b>${month}</b></div>
      <div class="kpi"><small>Conversion</small><b>${conv}</b></div>
    </div>
    <table><thead><tr><th>Time</th><th>Page</th><th>User</th><th>Device</th><th>Browser</th><th>Country</th><th>Source</th></tr></thead>
    <tbody>${rowsHtml}</tbody></table>
    <div class="noprint" style="margin-top:16px"><button onclick="window.print()">Print / Save as PDF</button></div>
    <script>setTimeout(()=>window.print(),400);</script>
    </body></html>`);
  win.document.close();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dateStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}
