/**
 * Report export helpers. CSV and Excel are produced client-side from plain
 * rows; PDF uses the browser print pipeline so no heavy dependency is needed.
 */

export type ExportColumn<T> = { header: string; value: (row: T) => string | number };

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function cell(v: string | number) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCsv<T>(rows: T[], columns: ExportColumn<T>[], filename: string) {
  const lines = [
    columns.map((c) => cell(c.header)).join(","),
    ...rows.map((r) => columns.map((c) => cell(c.value(r))).join(",")),
  ];
  download(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
}

function escapeHtml(v: string | number) {
  return String(v ?? "").replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch] as string));
}

/** Excel-readable workbook (HTML table format opened natively by Excel). */
export function exportExcel<T>(rows: T[], columns: ExportColumn<T>[], filename: string, title: string) {
  const head = columns.map((c) => `<th>${escapeHtml(c.header)}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${columns.map((c) => `<td>${escapeHtml(c.value(r))}</td>`).join("")}</tr>`)
    .join("");
  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8" /></head>
<body><h3>${escapeHtml(title)}</h3><table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  download(new Blob([html], { type: "application/vnd.ms-excel" }), `${filename}.xls`);
}

/** Opens a print-ready document; the user saves it as PDF. */
export function exportPdf<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  title: string,
  subtitle: string,
  summary: { label: string; value: string }[] = [],
) {
  const head = columns.map((c) => `<th>${escapeHtml(c.header)}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${columns.map((c) => `<td>${escapeHtml(c.value(r))}</td>`).join("")}</tr>`)
    .join("");
  const cards = summary
    .map((s) => `<div class="card"><span>${escapeHtml(s.label)}</span><strong>${escapeHtml(s.value)}</strong></div>`)
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #14261c; margin: 32px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p.sub { color: #5b6b62; font-size: 12px; margin: 0 0 20px; }
  .cards { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
  .card { border: 1px solid #d8e0da; border-radius: 10px; padding: 10px 14px; min-width: 150px; }
  .card span { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #5b6b62; }
  .card strong { font-size: 16px; }
  table { border-collapse: collapse; width: 100%; font-size: 11px; }
  th, td { border: 1px solid #d8e0da; padding: 6px 8px; text-align: left; }
  th { background: #f2f6f3; }
</style></head>
<body><h1>${escapeHtml(title)}</h1><p class="sub">${escapeHtml(subtitle)}</p>
<div class="cards">${cards}</div>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
<script>window.onload = () => { window.print(); };</script>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
