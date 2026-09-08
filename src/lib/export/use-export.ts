/**
 * Export orchestration: collect → prepare → generate → ready.
 *
 * The same pipeline serves every module and every format, so a section export
 * and a whole-farm export behave identically.
 */

import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUserId, useFarm, useFarmId } from "@/lib/farm-data";
import { useFarmContext } from "@/lib/rbac";
import { DESCRIPTOR_BY_KEY, type Row, type SummaryLine } from "./registry";
import { fetchDescriptorRows } from "./fetch";
import { rangeSuffix, rangeText, type ResolvedRange } from "./range";
import { csvBlob, csvZipBlob, descriptorCsv } from "./csv";

export type ExportFormat = "pdf" | "excel" | "csv";

export type ExportStep = 0 | 1 | 2 | 3 | 4;

export const STEP_LABELS = [
  "",
  "Collecting farm records",
  "Preparing report",
  "Generating file",
  "Ready",
];

export function sanitizeName(value: string) {
  return (value || "Farm")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "Farm";
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export type RunExportInput = {
  /** Human title, e.g. "Brooding Record Report". */
  title: string;
  /** Short file token, e.g. "Brooding". */
  fileToken: string;
  keys: string[];
  format: ExportFormat;
  range: ResolvedRange;
  scopeLabel: string;
  roomId?: string | null;
  roomName?: string | null;
  batchId?: string | null;
};

export function useRecordExport() {
  const { data: farmId } = useFarmId();
  const { data: farm } = useFarm();
  const { data: userId } = useAuthUserId();
  const { data: ctx } = useFarmContext();
  const [step, setStep] = useState<ExportStep>(0);
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep(0);
    setDetail("");
    setError(null);
  }, []);

  const run = useCallback(
    async (input: RunExportInput) => {
      if (!farmId) throw new Error("No farm selected");
      setError(null);
      const farmName = farm?.name || "Your farm";
      const periodText = rangeText(input.range);
      const generatedText = new Date().toLocaleString("en-GB", {
        dateStyle: "long",
        timeStyle: "short",
      });

      try {
        setStep(1);
        const sections: { desc: (typeof DESCRIPTOR_BY_KEY)[string]; rows: Row[] }[] = [];
        for (const key of input.keys) {
          const desc = DESCRIPTOR_BY_KEY[key];
          if (!desc) continue;
          setDetail(`Fetching ${desc.label.toLowerCase()} records…`);
          const rows = await fetchDescriptorRows(desc, {
            farmId,
            range: input.range,
            roomId: input.roomId ?? null,
            roomName: input.roomName ?? null,
            batchId: input.batchId ?? null,
          });
          sections.push({ desc, rows });
        }

        setStep(2);
        setDetail("Preparing report");
        const summary: SummaryLine[] = [];
        for (const { desc, rows } of sections) {
          if (!desc.summary || !rows.length) continue;
          for (const line of desc.summary(rows)) {
            summary.push({ label: `${desc.label} — ${line.label}`, value: line.value });
          }
        }
        const totalRows = sections.reduce((a, s) => a + s.rows.length, 0);

        setStep(3);
        setDetail("Generating file");
        const stamp = rangeSuffix(input.range);
        const base = `PoultryPro_${input.fileToken}_Report_${sanitizeName(farmName)}_${stamp}`;

        if (input.format === "csv") {
          if (sections.length === 1) {
            download(csvBlob(descriptorCsv(sections[0].desc, sections[0].rows)), `${base}.csv`);
          } else {
            download(
              csvZipBlob(
                sections.map(({ desc, rows }) => ({
                  name: `${desc.fileName}.csv`,
                  content: descriptorCsv(desc, rows),
                })),
              ),
              `${base}.zip`,
            );
          }
        } else if (input.format === "excel") {
          const { buildWorkbook } = await import("./xlsx");
          const blob = await buildWorkbook({
            title: input.title,
            farmName,
            periodText,
            generatedText,
            summary,
            sheets: sections,
          });
          download(blob, `${base}.xlsx`);
        } else {
          const { buildPdf } = await import("./pdf");
          const blob = buildPdf({
            title: input.title,
            farmName,
            periodText,
            generatedText,
            summary,
            sections,
            notes: [
              "Figures in the executive summary are calculated from the records inside the reporting period shown above.",
            ],
          });
          download(blob, `${base}.pdf`);
        }

        setStep(4);
        setDetail("Your report is ready.");

        if (userId) {
          // Metadata only — never record contents.
          await supabase
            .from("export_audit_log")
            .insert({
              farm_id: farmId,
              user_id: userId,
              actor_name: ctx?.fullName || ctx?.email || null,
              export_label: input.title,
              scope: input.scopeLabel,
              format: input.format,
              record_types: input.keys,
              range_label: periodText,
              range_from: input.range.from,
              range_to: input.range.to,
              row_count: totalRows,
            })
            .then(() => undefined, () => undefined);
        }

        return { totalRows };
      } catch (e) {
        setStep(0);
        setError(e instanceof Error ? e.message : "Could not generate the report.");
        throw e;
      }
    },
    [farmId, farm?.name, userId, ctx?.fullName, ctx?.email],
  );

  return { run, step, detail, error, reset };
}
