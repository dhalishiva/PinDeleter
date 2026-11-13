import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

export const qk = {
  config: ['config'] as const,
  profile: ['profile'] as const,
  connections: ['connections'] as const,
  boards: (connectionId: string) => ['boards', connectionId] as const,
  pins: (connectionId: string, filters: unknown) => ['pins', connectionId, filters] as const,
  pinCount: (connectionId: string, filters: unknown) => ['pinCount', connectionId, filters] as const,
  syncRun: (id: string) => ['syncRun', id] as const,
  latestSync: (connectionId: string) => ['latestSync', connectionId] as const,
  jobs: ['jobs'] as const,
  job: (id: string) => ['job', id] as const,
  jobEvents: (id: string) => ['jobEvents', id] as const,
  jobPending: (id: string) => ['jobPending', id] as const,
  payments: ['payments'] as const,
};
