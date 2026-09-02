"use client";

import { FileDown, Loader2 } from "lucide-react";
import { useCreateExport, useDownloadExport } from "@/lib/hooks/useExports";
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
  autoDownload?: boolean;
}

/**
 * Reusable "Generate Report" action. Creates a real report from current backend data via
 * the /exports subsystem; it then generates and downloads the authentic valid PDF/CSV artifact.
 */
export function GenerateReportButton({
  exportType,
  format = "PDF" as ExportFormat,
  title,
  filters,
  parameters,
  className = "",
  label = "Generate Report",
  autoDownload = true,
}: GenerateReportButtonProps) {
  const createExport = useCreateExport();
  const downloadExport = useDownloadExport();
  const { mode } = useDataMode();

  const handleClick = () => {
    const input: CreateExportInput = {
      export_type: exportType,
      format,
      title,
      filters: (filters ?? {}) as Record<string, unknown>,
      parameters: { ...(parameters ?? {}), data_mode: mode } as Record<string, unknown>,
    };
    createExport.mutate(input, {
      onSuccess: async (job) => {
        if (autoDownload) {
          await downloadExport.mutateAsync(job);
        }
      },
    });
  };

  const isWorking = createExport.isPending || downloadExport.isPending;

  return (
    <button
      onClick={handleClick}
      disabled={isWorking}
      className={`inline-flex items-center gap-1.5 rounded border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-60 cursor-pointer ${className}`}
      title="Generate a report from current data and download it immediately"
    >
      {isWorking ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <FileDown className="h-3.5 w-3.5" />
      )}
      {isWorking ? "Generating..." : label}
    </button>
  );
}
