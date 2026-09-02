import { apiClient, Paginated } from './client';
import { CreateExportInput, ExportDownloadInfo, ExportJob } from '@/types';

export const exportsApi = {
  /** Create a new export job */
  createExport: (payload: CreateExportInput) =>
    apiClient.postData<ExportJob>('/exports', payload),

  /** List export jobs with optional filtering */
  listExports: (params?: { export_type?: string; status?: string; page?: number; page_size?: number }) =>
    apiClient.getPaginated<ExportJob>('/exports', params as Record<string, string | number | boolean | null | undefined>),

  /** Get a single export job */
  getExportJob: (jobId: string) =>
    apiClient.getData<ExportJob>(`/exports/${jobId}`),

  /** Get authorized download URL for a completed export */
  getDownloadUrl: (jobId: string) =>
    apiClient.getData<ExportDownloadInfo>(`/exports/${jobId}/download`),

  /** Retry a failed export */
  retryExport: (jobId: string) =>
    apiClient.postData<ExportJob>(`/exports/${jobId}/retry`, {}),

  /** Delete export metadata */
  deleteExport: (jobId: string) =>
    apiClient.request<{ success: boolean; data: { deleted: boolean; job_id: string } }>(`/exports/${jobId}`, {
      method: 'DELETE',
    }),
};
