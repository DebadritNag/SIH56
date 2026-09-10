'use client';
import { useQuery } from '@tanstack/react-query';
import { getData } from '@/lib/api/client';
import { useDataMode } from '@/lib/providers/DataModeProvider';
import { DEMO_SHOCKS } from '@/lib/mock-data/shocks';

type Shock = typeof DEMO_SHOCKS[number];
type ShockResponse = { items: Shock[]; active_count: number };

export function usePriceShocks() {
  const { mode } = useDataMode();
  const isMock = mode === 'mock';
  const query = useQuery({
    queryKey: ['price-shocks', mode],
    queryFn: async (): Promise<ShockResponse> => isMock
      ? { items: DEMO_SHOCKS, active_count: DEMO_SHOCKS.filter(s => s.status === 'CONFIRMED').length }
      : getData<ShockResponse>('/alerts/confirmed-shocks'),
    placeholderData: undefined,
    refetchInterval: isMock ? false : 30000,
  });
  return { ...query, isMock, shocks: query.data?.items ?? [], activeCount: query.data?.active_count ?? 0 };
}
