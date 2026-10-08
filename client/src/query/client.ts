import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api';
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30000,
        gcTime: 300000,
        retry: (attempt: number, error: Error) =>
          !(error instanceof ApiError && error.status < 500) && attempt < 1,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
}
