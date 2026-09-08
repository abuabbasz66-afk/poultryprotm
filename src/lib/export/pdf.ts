import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ExportDescriptor, Row, SummaryLine } from "./registry";
import { getPoultryProReportLogo, REPORT_TAGLINE } from "./report-branding";

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
    return `NGN ${n.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
  }
  if (type === "number") {
    const n = Number(v ?? 0);
    return n.toLocaleString("en-NG", { maximumFractionDigits: 3 });
  }
  return v == null ? "" : String(v);
}

export type PdfSection = { desc: ExportDescriptor; rows: Row[] };

export async function buildPdf(opts: {
  title: string;
  farmName: string;
  periodText: string;
  generatedText: string;
  summary: SummaryLine[];
  sections: PdfSection[];
  notes?: string[];
}): Promise<Blob> {
  const logoDataUrl = await getPoultryProReportLogo();
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 32;

  // The official high-resolution square logo is kept at a 1:1 ratio.
  doc.addImage(logoDataUrl, "PNG", margin, 14, 104, 104, "poultrypro-logo", "NONE");

  const headingX = margin + 126;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 105, 96);
  doc.text(REPORT_TAGLINE, headingX, 31);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 38, 28);
  doc.text(opts.title.toUpperCase(), headingX, 53);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Farm: ${opts.farmName}`, headingX, 75);
  doc.text(`Reporting period: ${opts.periodText}`, headingX, 91);
  doc.text(`Generated: ${opts.generatedText}`, headingX, 107);
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.8);
  doc.line(margin, 130, pageWidth - margin, 130);

  let cursor = 148;

  if (opts.summary.length) {
    autoTable(doc, {
      startY: cursor,
      head: [["Executive summary", "Value"]],
      body: opts.summary.map((l) => [l.label, l.value]),
      theme: "grid",
      margin: { top: 54, left: margin, right: margin, bottom: 42 },
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
      margin: { top: 54, left: margin, right: margin, bottom: 42 },
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
    if (i > 1) {
      doc.addImage(logoDataUrl, "PNG", margin, 5, 38, 38, "poultrypro-logo", "NONE");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(90, 105, 96);
      doc.text(REPORT_TAGLINE, margin + 48, 20);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...GREEN);
      doc.text(opts.title.toUpperCase(), margin + 48, 33);
      doc.setDrawColor(...GREEN);
      doc.setLineWidth(0.5);
      doc.line(margin, 45, pageWidth - margin, 45);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 132, 124);
    doc.text(
      `PoultryPro · ${REPORT_TAGLINE}`,
      margin,
      doc.internal.pageSize.getHeight() - 25,
    );
    doc.text(
      `Farm: ${opts.farmName}`,
      margin,
      doc.internal.pageSize.getHeight() - 13,
    );
    doc.text(
      `Page ${i} of ${pages}`,
      pageWidth - margin,
      doc.internal.pageSize.getHeight() - 13,
      { align: "right" },
    );
  }

  return doc.output("blob");
}
