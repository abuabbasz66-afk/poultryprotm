import { zipSync, strToU8 } from "fflate";
import type { ExportDescriptor, Row } from "./registry";

function cell(v: string | number | null) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function descriptorCsv(desc: ExportDescriptor, rows: Row[]): string {
  const head = desc.columns.map((c) => cell(c.header)).join(",");
  const body = rows.map((r) => desc.columns.map((c) => cell(c.value(r))).join(","));
  return [head, ...body].join("\n");
}

/** UTF-8 CSV blob (BOM so Excel opens accents correctly). */
export function csvBlob(text: string) {
  return new Blob([`\uFEFF${text}`], { type: "text/csv;charset=utf-8" });
}

export function csvZipBlob(files: { name: string; content: string }[]) {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) entries[f.name] = strToU8(`\uFEFF${f.content}`);
  const zipped = zipSync(entries, { level: 6 });
  return new Blob([zipped as unknown as BlobPart], { type: "application/zip" });
}
