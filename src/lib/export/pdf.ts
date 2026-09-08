import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ExportDescriptor, Row, SummaryLine } from "./registry";

const GREEN: [number, number, number] = [20, 61, 42];
const LIGHT: [number, number, number] = [242, 246, 243];

function fmtDate(v: string | number | null) {
  if (v == null || v === "") return "";
  const raw = String(v);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return raw;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtCell(v: string | number | null, type?: string) {
  if (type === "date") return fmtDate(v);
  if (type === "currency") {
    const n = Number(v ?? 0);
    return `₦${n.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
  }
  if (type === "number") {
    const n = Number(v ?? 0);
    return n.toLocaleString("en-NG", { maximumFractionDigits: 3 });
  }
  return v == null ? "" : String(v);
}

export type PdfSection = { desc: ExportDescriptor; rows: Row[] };

export function buildPdf(opts: {
  title: string;
  farmName: string;
  periodText: string;
  generatedText: string;
  summary: SummaryLine[];
  sections: PdfSection[];
  notes?: string[];
}): Blob {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 32;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...GREEN);
  doc.text("POULTRYPRO", margin, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 105, 96);
  doc.text("Smart Farming. Better Decisions. Higher Profits.", margin, 60);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 38, 28);
  doc.text(opts.title.toUpperCase(), margin, 86);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Farm: ${opts.farmName}`, margin, 104);
  doc.text(`Reporting period: ${opts.periodText}`, margin, 118);
  doc.text(`Generated: ${opts.generatedText}`, margin, 132);

  let cursor = 150;

  if (opts.summary.length) {
    autoTable(doc, {
      startY: cursor,
      head: [["Executive summary", "Value"]],
      body: opts.summary.map((l) => [l.label, l.value]),
      theme: "grid",
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: LIGHT },
      tableWidth: Math.min(420, pageWidth - margin * 2),
    });
    cursor = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;
  }

  if (opts.notes?.length) {
    doc.setFontSize(8);
    doc.setTextColor(90, 105, 96);
    for (const note of opts.notes) {
      doc.text(note, margin, cursor);
      cursor += 12;
    }
    cursor += 8;
    doc.setTextColor(20, 38, 28);
  }

  for (const section of opts.sections) {
    if (cursor > doc.internal.pageSize.getHeight() - 120) {
      doc.addPage();
      cursor = 60;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...GREEN);
    doc.text(section.desc.label, margin, cursor);
    cursor += 8;
    doc.setTextColor(20, 38, 28);

    if (!section.rows.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("No records found for the selected period.", margin, cursor + 12);
      cursor += 36;
      continue;
    }

    autoTable(doc, {
      startY: cursor + 6,
      head: [section.desc.columns.map((c) => c.header)],
      body: section.rows.map((r) => section.desc.columns.map((c) => fmtCell(c.value(r), c.type))),
      theme: "grid",
      margin: { left: margin, right: margin },
      styles: { fontSize: 7.5, cellPadding: 3, overflow: "linebreak" },
      headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: LIGHT },
      showHead: "everyPage",
      tableWidth: "auto",
    });
    cursor = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 26;
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 132, 124);
    doc.text(
      `PoultryPro · ${opts.farmName} · ${opts.periodText}`,
      margin,
      doc.internal.pageSize.getHeight() - 18,
    );
    doc.text(
      `Page ${i} of ${pages}`,
      pageWidth - margin,
      doc.internal.pageSize.getHeight() - 18,
      { align: "right" },
    );
  }

  return doc.output("blob");
}
