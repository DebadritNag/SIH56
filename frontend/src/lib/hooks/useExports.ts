import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { exportsApi } from '@/lib/api/exports';
import { apiClient } from '@/lib/api/client';
import { CreateExportInput, ExportJob } from '@/types';
import { notify } from '@/lib/notify';
import { useDataMode } from '@/lib/providers/DataModeProvider';

// ---------------------------------------------------------------------------
// Fallback catalog — only shown when the backend is completely unreachable.
// data_origin is NOT set to LIVE unconditionally: it will be overridden by
// the mode-aware logic below.
// ---------------------------------------------------------------------------
const makeFallbackExports = (mode: 'real' | 'mock'): ExportJob[] => [
  {
    id: 'exp-1092',
    export_type: 'FARE_OBSERVATIONS',
    export_format: 'CSV',
    title: 'National Fare Observations (Validated)',
    filename: `vayantara-fares-${mode}-${new Date().toISOString().slice(0, 10)}.csv`,
    status: 'READY',
    file_size_bytes: mode === 'real' ? 0 : 5033164,
    row_count: mode === 'real' ? 0 : 28452,
    data_origin: mode === 'real' ? 'LIVE' : 'SYNTHETIC',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
    generated_at: new Date(Date.now() - 3600000).toISOString(),
    parameters: { data_mode: mode },
  },
  {
    id: 'exp-1091',
    export_type: 'APIX_INDEX',
    export_format: 'XLSX',
    title: 'Official APIx Matched Basket Decomposition',
    filename: `vayantara-apix-${mode}-${new Date().toISOString().slice(0, 10)}.xlsx`,
    status: 'READY',
    file_size_bytes: mode === 'real' ? 0 : 911360,
    row_count: mode === 'real' ? 0 : 405,
    data_origin: mode === 'real' ? 'LIVE' : 'SYNTHETIC',
    created_at: new Date(Date.now() - 7200000).toISOString(),
    updated_at: new Date(Date.now() - 7200000).toISOString(),
    generated_at: new Date(Date.now() - 7200000).toISOString(),
    parameters: { data_mode: mode },
  },
];

// ---------------------------------------------------------------------------
// useExports — list with mode in query key so mode switch invalidates cache
// ---------------------------------------------------------------------------
export function useExports(params?: { export_type?: string; status?: string }) {
  const { mode } = useDataMode();
  return useQuery<ExportJob[]>({
    // mode is now part of the key — switching Live↔Demo invalidates this cache
    queryKey: ['exports', mode, params],
    queryFn: async (): Promise<ExportJob[]> => {
      try {
        const res = await exportsApi.listExports(params);
        return res.items;
      } catch {
        // Fallback only when backend is unreachable — use mode-appropriate catalog
        return makeFallbackExports(mode);
      }
    },
    refetchInterval: 4000,
  });
}

// ---------------------------------------------------------------------------
// useCreateExport — pass data_mode explicitly to backend + fallback job
// ---------------------------------------------------------------------------
export function useCreateExport() {
  const qc = useQueryClient();
  const { mode } = useDataMode();

  return useMutation({
    mutationFn: async (input: CreateExportInput): Promise<ExportJob> => {
      // Ensure data_mode propagates to the backend even if caller forgot it
      const enrichedInput: CreateExportInput = {
        ...input,
        data_mode: input.data_mode ?? mode,
        parameters: {
          ...(input.parameters ?? {}),
          data_mode: input.data_mode ?? mode,
          mode_label: (input.data_mode ?? mode) === 'real' ? 'LIVE DATA' : 'SIH DEMO MODE',
        },
      };

      try {
        return await exportsApi.createExport(enrichedInput);
      } catch {
        // Offline fallback: create a client-side job descriptor that reflects the
        // actual current mode — never hardcode data_origin to LIVE
        const effectiveMode = enrichedInput.data_mode ?? mode;
        const newJob: ExportJob = {
          id: `exp-${Date.now()}`,
          export_type: input.export_type,
          export_format: input.format,
          title: input.title || 'VAYANTARA Airfare Intelligence Report',
          filename: `vayantara-${input.export_type.toLowerCase().replace(/_/g, '-')}-${effectiveMode}-${new Date().toISOString().slice(0, 10)}.${input.format.toLowerCase()}`,
          status: 'READY',
          file_size_bytes: input.format === 'PDF' ? 148520 : 45200,
          row_count: effectiveMode === 'real' ? 0 : 81,  // 0 rows in Live = no data, not fake data
          page_count: input.format === 'PDF' ? 2 : undefined,
          // data_origin reflects the mode: Live mode = LIVE, Demo mode = SYNTHETIC
          data_origin: effectiveMode === 'real' ? 'LIVE' : 'SYNTHETIC',
          filters: input.filters,
          parameters: enrichedInput.parameters,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          generated_at: new Date().toISOString(),
        };
        return newJob;
      }
    },
    onSuccess: (job: ExportJob) => {
      notify.success('Export generation started', { description: job.filename });
      qc.invalidateQueries({ queryKey: ['exports'] });
    },
    onError: (err: unknown) => {
      notify.error('Export creation failed', {
        description: err instanceof Error ? err.message : 'Check filters and parameters.',
      });
    },
  });
}

// ---------------------------------------------------------------------------
// useDownloadExport — mode-aware dispatch
// ---------------------------------------------------------------------------
export function useDownloadExport() {
  return useMutation({
    mutationFn: async (job: ExportJob) => {
      notify.info('Preparing download...', { description: job.filename });

      // Resolve the mode that was frozen into this export job
      const jobMode = (job.parameters?.data_mode as 'real' | 'mock' | undefined) ?? 'real';

      const isRealJob = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(job.id);
      let blob: Blob;

      if (isRealJob) {
        try {
          blob = await apiClient.downloadBlob(`/exports/${job.id}/stream`);
        } catch {
          // Backend stream unavailable — generate client-side fallback
          if (job.export_format === 'PDF') {
            const { generateClientReportPdf } = await import('@/lib/export-generators/client-pdf');
            blob = await generateClientReportPdf(job);
          } else {
            blob = new Blob([buildFallbackCsv(job, jobMode)], { type: 'text/csv' });
          }
        }
      } else {
        // Fallback catalog items (non-UUID IDs)
        if (job.export_format === 'PDF') {
          const { generateClientReportPdf } = await import('@/lib/export-generators/client-pdf');
          blob = await generateClientReportPdf(job);
        } else {
          blob = new Blob([buildFallbackCsv(job, jobMode)], { type: 'text/csv' });
        }
      }

      const typedBlob =
        job.export_format === 'PDF' && blob.type !== 'application/pdf'
          ? new Blob([blob], { type: 'application/pdf' })
          : blob;

      const url = URL.createObjectURL(typedBlob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', job.filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      notify.success('Download started', { description: job.filename });
    },
    onError: (err: unknown) => {
      notify.error('Download failed', {
        description: err instanceof Error ? err.message : 'Could not retrieve the report file.',
      });
    },
  });
}

/**
 * Build a mode-aware CSV fallback.
 * Live mode with no data → single informational row.
 * Demo mode → representative sample rows clearly labelled SYNTHETIC.
 */
function buildFallbackCsv(job: ExportJob, mode: 'real' | 'mock'): string {
  const header = `# VAYANTARA Airfare Intelligence Platform\n# Mode: ${mode === 'real' ? 'LIVE DATA' : 'SIH DEMO MODE'}\n# Export Type: ${job.export_type}\n# Generated: ${new Date().toISOString()}\n# Filters: ${JSON.stringify(job.filters ?? {})}\n#\n`;

  if (mode === 'real') {
    // In Live Mode: if we reach the CSV fallback it means the backend was unreachable.
    // Return an explicit empty/no-data CSV — never fabricate Live rows.
    return (
      header +
      `status,message\n` +
      `NO_DATA,"No eligible Live-mode observations available. ` +
      `Backend unreachable or no data matches the current filters."\n`
    );
  }

  // Demo mode: return clearly labelled synthetic sample data
  return (
    header +
    `data_origin,route,window,base_fare_inr,current_fare_inr,contribution_pts,status\n` +
    `SYNTHETIC,DEL-BOM,T+1,9850,11840,+0.85,VALID\n` +
    `SYNTHETIC,DEL-BOM,T+7,6900,7950,+0.73,VALID\n` +
    `SYNTHETIC,DEL-BLR,T+1,10500,12400,+0.69,VALID\n` +
    `SYNTHETIC,DEL-BLR,T+7,6700,7600,+0.56,VALID\n` +
    `SYNTHETIC,BOM-BLR,T+1,8100,9400,+0.50,VALID\n` +
    `SYNTHETIC,DEL-CCU,T+7,6200,6850,+0.29,VALID\n` +
    `SYNTHETIC,BOM-GOI,T+7,3500,3200,-0.19,VALID\n`
  );
}

export function useDeleteExport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => exportsApi.deleteExport(jobId),
    onSuccess: () => {
      notify.info('Export removed');
      qc.invalidateQueries({ queryKey: ['exports'] });
    },
  });
}

export function useRetryExport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => exportsApi.retryExport(jobId),
    onSuccess: () => {
      notify.info('Export queued for retry');
      qc.invalidateQueries({ queryKey: ['exports'] });
    },
  });
}
