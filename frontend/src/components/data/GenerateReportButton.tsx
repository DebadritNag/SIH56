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
 * Reusable "Generate Report" action.
 *
 * MODE SAFETY: The current DataMode is captured at click time and frozen into
 * the export request so a mode switch mid-generation cannot corrupt the output.
 * `data_mode` is injected both as a top-level field (for the backend resolver)
 * and inside `parameters` (for the client-side PDF generator).
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
  const { mode, isSwitching } = useDataMode();

  const handleClick = () => {
    // Freeze mode at click time — do not read it again during async processing.
    const frozenMode: 'real' | 'mock' = mode;

    const input: CreateExportInput = {
      export_type: exportType,
      format,
      title,
      data_mode: frozenMode,                        // top-level for backend resolver
      filters: (filters ?? {}) as Record<string, unknown>,
      parameters: {
        ...(parameters ?? {}),
        data_mode: frozenMode,                      // also in parameters for client-pdf
        mode_label: frozenMode === 'real' ? 'LIVE DATA' : 'SIH DEMO MODE',
        generated_at: new Date().toISOString(),
        page: exportType,
      } as Record<string, unknown>,
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
  // Do not allow export during mode switch — mode state is in transition
  const disabled = isWorking || isSwitching;

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-60 cursor-pointer ${className}`}
      title={
        isSwitching
          ? "Mode switching — please wait before generating a report"
          : `Generate a ${mode === 'real' ? 'Live Data' : 'Demo'} report from the current page context`
      }
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
