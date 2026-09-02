import { toast } from 'sonner';

export interface ToastOptions {
  description?: string;
  duration?: number;
  id?: string | number;
  action?: {
    label: string;
    onClick: () => void;
  };
  cancel?: {
    label: string;
    onClick?: () => void;
  };
  requestId?: string;
}

/**
 * AirPulse Centralized Notification Service
 * Institutional styling, stable IDs, deduplication, and zero raw exceptions.
 */
export const notify = {
  success: (title: string, options?: ToastOptions) => {
    return toast.success(title, {
      description: options?.description,
      duration: options?.duration ?? 3500,
      id: options?.id,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
    });
  },

  error: (title: string, options?: ToastOptions) => {
    const formattedDesc = options?.requestId
      ? `${options.description ? options.description + ' • ' : ''}Request ID: ${options.requestId}`
      : options?.description;

    return toast.error(title, {
      description: formattedDesc,
      duration: options?.duration ?? 6500,
      id: options?.id,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
    });
  },

  warning: (title: string, options?: ToastOptions) => {
    return toast.warning(title, {
      description: options?.description,
      duration: options?.duration ?? 5000,
      id: options?.id,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
    });
  },

  info: (title: string, options?: ToastOptions) => {
    return toast.info(title, {
      description: options?.description,
      duration: options?.duration ?? 3000,
      id: options?.id,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
    });
  },

  loading: (title: string, options?: ToastOptions) => {
    return toast.loading(title, {
      description: options?.description,
      id: options?.id,
    });
  },

  download: (filename: string, details?: string, onDownload?: () => void) => {
    return toast.success('Export file ready', {
      description: details ? `${filename} (${details})` : filename,
      duration: 7000,
      action: onDownload
        ? {
            label: 'Download',
            onClick: onDownload,
          }
        : undefined,
    });
  },

  copied: (label: string = 'Identifier') => {
    return toast.info('Copied to clipboard', {
      description: `${label} copied.`,
      duration: 2000,
    });
  },

  promise: async <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: any) => string);
    },
    options?: { id?: string | number }
  ) => {
    return toast.promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
      id: options?.id,
    });
  },

  dismiss: (id?: string | number) => {
    toast.dismiss(id);
  },
};
