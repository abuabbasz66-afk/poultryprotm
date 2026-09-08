import ExcelJS from "exceljs";
import type { ExportDescriptor, Row, SummaryLine } from "./registry";
import { neutralizeFormula } from "./csv";

const CURRENCY_FMT = '₦#,##0.00;[Red]-₦#,##0.00;"-"';
const NUMBER_FMT = "#,##0.###";
const DATE_FMT = "dd mmm yyyy";

function asDate(v: string | number | null): Date | string | null {
  if (v == null || v === "") return null;
  const raw = String(v);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return raw;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export type SheetSpec = { desc: ExportDescriptor; rows: Row[] };

export async function buildWorkbook(opts: {
  title: string;
  farmName: string;
  periodText: string;
  generatedText: string;
  summary: SummaryLine[];
  sheets: SheetSpec[];
}): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "PoultryPro";
  wb.created = new Date();

  const summary = wb.addWorksheet("Summary");
  summary.columns = [{ width: 34 }, { width: 34 }];
  const heading = summary.addRow(["POULTRYPRO", ""]);
  heading.font = { bold: true, size: 16, name: "Arial" };
  summary.addRow(["Smart Farming. Better Decisions. Higher Profits.", ""]);
  summary.addRow([]);
  summary.addRow(["Report", opts.title]);
  summary.addRow(["Farm", opts.farmName]);
  summary.addRow(["Reporting period", opts.periodText]);
  summary.addRow(["Generated", opts.generatedText]);
  summary.addRow([]);
  const shead = summary.addRow(["Metric", "Value"]);
  shead.font = { bold: true, name: "Arial" };
  for (const line of opts.summary) summary.addRow([line.label, line.value]);

  for (const { desc, rows } of opts.sheets) {
    const name = desc.label.replace(/[\\/*?:[\]]/g, " ").slice(0, 31);
    const ws = wb.addWorksheet(name);
    ws.columns = desc.columns.map((c) => ({
      header: c.header,
      key: c.header,
      width: c.width ?? Math.min(30, Math.max(12, c.header.length + 4)),
    }));
    ws.getRow(1).font = { bold: true, name: "Arial" };
    ws.views = [{ state: "frozen", ySplit: 1 }];

    for (const r of rows) {
      const values = desc.columns.map((c) => {
        const v = c.value(r);
        if (c.type === "date") return asDate(v);
        if (c.type === "number" || c.type === "currency") return Number(v ?? 0);
        return neutralizeFormula(v) ?? "";
      });
      ws.addRow(values);
    }

    desc.columns.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      if (c.type === "currency") col.numFmt = CURRENCY_FMT;
      else if (c.type === "number") col.numFmt = NUMBER_FMT;
      else if (c.type === "date") col.numFmt = DATE_FMT;
    });

    if (rows.length) {
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: desc.columns.length },
      };
    } else {
      ws.addRow(["No records found for the selected period."]);
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
