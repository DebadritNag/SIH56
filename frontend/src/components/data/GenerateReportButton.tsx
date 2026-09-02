"use client";

import { FileDown, Loader2 } from "lucide-react";
import { useCreateExport } from "@/lib/hooks/useExports";
import { useDataMode } from "@/lib/providers/DataModeProvider";
import { notify } from "@/lib/notify";
import type { CreateExportInput, ExportType, ExportFormat } from "@/types";

interface GenerateReportButtonProps {
  exportType: ExportType;
  format?: ExportFormat;
  title: string;
  filters?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  className?: string;
  label?: string;
}

/**
 * Reusable "Generate Report" action. Creates a real report from current backend data via
 * the /exports subsystem; it then appears in the Export & Download Center for download.
 * In MOCK mode it warns that the report will be built from demo data.
 */
export function GenerateReportButton({
  exportType,
  format = "PDF" as ExportFormat,
  title,
  filters,
  parameters,
  className = "",
  label = "Generate Report",
}: GenerateReportButtonProps) {
  const createExport = useCreateExport();
  const { mode } = useDataMode();

  const handleClick = () => {
    if (mode === "mock") {
      notify.warning("Generating report from MOCK DATA", {
        description: "Switch to Live mode for a report from real scraped/processed data.",
      });
    }
    const input: CreateExportInput = {
      export_type: exportType,
      format,
      title,
      filters: (filters ?? {}) as Record<string, unknown>,
      parameters: { ...(parameters ?? {}), data_mode: mode } as Record<string, unknown>,
    };
    createExport.mutate(input);
  };

  return (
    <button
      onClick={handleClick}
      disabled={createExport.isPending}
      className={`inline-flex items-center gap-1.5 rounded border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-60 cursor-pointer ${className}`}
      title="Generate a report from current data and save it to the Download Center"
    >
      {createExport.isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <FileDown className="h-3.5 w-3.5" />
      )}
      {label}
    </button>
  );
}
