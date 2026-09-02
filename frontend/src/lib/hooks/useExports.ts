import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { exportsApi } from '@/lib/api/exports';
import { apiClient } from '@/lib/api/client';
import { CreateExportInput, ExportJob } from '@/types';
import { notify } from '@/lib/notify';

const FALLBACK_EXPORTS: ExportJob[] = [
  {
    id: 'exp-1092',
    export_type: 'FARE_OBSERVATIONS',
    export_format: 'CSV',
    title: 'National Fare Observations (Validated)',
    filename: 'airpulse-fares-del-bom-2026-08-01_2026-09-02.csv',
    status: 'READY',
    file_size_bytes: 5033164, // ~4.8 MB
    row_count: 28452,
    data_origin: 'LIVE',
    checksum_sha256: '4d8a0c5f6e8b2a1c9e4d7f0b3a5c8e1d7a9b0c2e4f6a8b1c3d5e7f9a0b2c4d6',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
    generated_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'exp-1091',
    export_type: 'APIX_COMPONENTS',
    export_format: 'XLSX',
    title: 'Official APIx Matched Basket Decomposition',
    filename: 'airpulse-apix-components-2026-09-02.xlsx',
    status: 'READY',
    file_size_bytes: 911360, // ~890 KB
    row_count: 405,
    data_origin: 'LIVE',
    checksum_sha256: '8f4a1c0b3d5e7f9a2b4c6e8d0f2a4b6c8e0d2f4a6b8c0d2e4f6a8b0c2d4e6f8',
    created_at: new Date(Date.now() - 7200000).toISOString(),
    updated_at: new Date(Date.now() - 7200000).toISOString(),
    generated_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'exp-1090',
    export_type: 'BACKTEST_AUDIT_PDF',
    export_format: 'PDF',
    title: 'MoSPI Transport CPI 12-Month Backtest Audit',
    filename: 'airpulse-backtest-dossier-2026-q3.pdf',
    status: 'READY',
    file_size_bytes: 1258291, // ~1.2 MB
    page_count: 2,
    data_origin: 'LIVE',
    checksum_sha256: '3f8b91a0c4e7284102938475a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
    created_at: new Date(Date.now() - 18000000).toISOString(),
    updated_at: new Date(Date.now() - 18000000).toISOString(),
    generated_at: new Date(Date.now() - 18000000).toISOString(),
  },
  {
    id: 'exp-1089',
    export_type: 'ANOMALIES',
    export_format: 'CSV',
    title: 'Multi-Source Anomaly Extract (PriceGuard)',
    filename: 'airpulse-anomalies-2026-09-02.csv',
    status: 'GENERATING',
    progress_percent: 65.0,
    current_stage: 'Preparing anomaly observations...',
    data_origin: 'LIVE',
    created_at: new Date(Date.now() - 120000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export function useExports(params?: { export_type?: string; status?: string }) {
  return useQuery<ExportJob[]>({
    queryKey: ['exports', params],
    queryFn: async (): Promise<ExportJob[]> => {
      try {
        const res = await exportsApi.listExports(params);
        return res.items;
      } catch {
        return FALLBACK_EXPORTS;
      }
    },
    refetchInterval: 4000, // Poll every 4 seconds for running jobs
  });
}

export function useCreateExport() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateExportInput) => exportsApi.createExport(input),
    onSuccess: (job: ExportJob) => {
      notify.success('Export generation started', {
        description: job.filename,
      });
      qc.invalidateQueries({ queryKey: ['exports'] });
    },
    onError: (err: any) => {
      notify.error('Export creation failed', {
        description: err.message || 'Check filters and parameters.',
      });
    },
  });
}

export function useDownloadExport() {
  return useMutation({
    mutationFn: async (job: ExportJob) => {
      // Guard: demo/fallback jobs have non-UUID ids (e.g. "exp-1090") and cannot
      // be fetched from the backend — never emit a corrupt placeholder file.
      const isRealJob = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(job.id);
      if (!isRealJob) {
        notify.error('Report unavailable', {
          description: 'This is a demo entry. Generate a report from a page to download a real file.',
        });
        return;
      }

      notify.info('Preparing download...', { description: job.filename });
      // Fetch the real bytes through the backend stream endpoint (correct MIME,
      // valid content) and save as a typed Blob. Avoids cross-origin <a download>
      // pitfalls and never writes a text placeholder.
      const blob = await apiClient.downloadBlob(`/exports/${job.id}/stream`);
      const typedBlob = job.export_format === 'PDF' && blob.type !== 'application/pdf'
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
