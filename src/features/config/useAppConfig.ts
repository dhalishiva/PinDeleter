import { useQuery } from '@tanstack/react-query';
import { callFunction } from '@/lib/api';
import { isConfigured } from '@/lib/env';
import { qk } from '@/lib/queryClient';
import type { AppConfig } from '@/lib/types';
import { FREE_DELETION_LIMIT } from '@/config/site';

const FALLBACK: AppConfig = {
  mockMode: false,
  freeLimit: FREE_DELETION_LIMIT,
  paypalClientId: null,
  paypalEnv: 'sandbox',
};

export function useAppConfig() {
  return useQuery({
    queryKey: qk.config,
    queryFn: async () =>
      isConfigured ? callFunction<AppConfig>('config', undefined, { method: 'GET', auth: false }) : FALLBACK,
    staleTime: 5 * 60_000,
    placeholderData: FALLBACK,
  });
}
