import {
  useMutation,
  useQuery,
  useQueryClient,
  type Query,
} from '@tanstack/react-query';
import {
  apiRequest,
  getProducts,
  getProduct,
  getCategories,
  getContents,
  getContent,
  getActivity,
} from '../api';
import { queryKeys, matchesDomain } from './keys';
import type {
  ProductQuery,
  ContentQuery,
  ActivityQuery,
  AuthUser,
  PaginatedResult,
} from '../types';
export function useProducts(query: ProductQuery, enabled = true) {
  return useQuery({
    enabled,
    queryKey: queryKeys.products(query),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      getProducts(query, signal),
  });
}
export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.product(id),
    queryFn: ({ signal }: { signal: AbortSignal }) => getProduct(id, signal),
  });
}
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories(),
    queryFn: ({ signal }: { signal: AbortSignal }) => getCategories(signal),
    staleTime: 300000,
  });
}
export function useContents(
  query: ContentQuery,
  userId?: string,
  enabled = true,
) {
  return useQuery({
    enabled,
    queryKey: queryKeys.content(query, userId),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      getContents(query, Boolean(userId), signal),
    staleTime: userId ? 0 : 30000,
  });
}
export function useContent(slug: string) {
  return useQuery({
    queryKey: queryKeys.contentDetail(slug),
    queryFn: ({ signal }: { signal: AbortSignal }) => getContent(slug, signal),
  });
}
export function useActivity(userId: string, query: ActivityQuery) {
  return useQuery({
    queryKey: queryKeys.activity(userId, query),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      getActivity(query, signal),
    staleTime: 0,
  });
}
export function useUsers(userId: string, page: number) {
  return useQuery({
    queryKey: queryKeys.users(userId, page),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiRequest<PaginatedResult<AuthUser>>(
        `/api/v1/admin/users?page=${page}&limit=20`,
        { signal },
      ),
    staleTime: 0,
  });
}
export function useRecordMutation<TInput, TResult>(
  domain: 'products' | 'content' | 'users',
  operation: (input: TInput) => Promise<TResult>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: operation,
    onSuccess: async () => {
      await client.invalidateQueries({
        predicate: (query: Query) => matchesDomain(query.queryKey, domain),
      });
    },
  });
}
