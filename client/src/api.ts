import type {
  Category,
  Product,
  ProductQuery,
  PaginatedResult,
  CreateProductInput,
  UpdateProductInput,
} from './types';

export interface HealthResponse {
  status: 'ok';
  service: string;
}
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
let csrfToken: string | null = null;
export function setCsrfToken(token: string | null) {
  csrfToken = token;
}
const baseUrl = import.meta.env.PROD
  ? ''
  : (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const timeout = AbortSignal.timeout(10000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout;
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      signal,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(csrfToken &&
        !['GET', 'HEAD', 'OPTIONS'].includes(options.method ?? 'GET')
          ? { 'X-CSRF-Token': csrfToken }
          : {}),
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
    if (response.status === 204) return undefined as T;
    let data: unknown;
    try {
      data = await response.json();
    } catch (error) {
      if (signal.aborted) throw error;
      throw new ApiError(
        response.status,
        'INVALID_RESPONSE',
        response.ok
          ? 'API returned invalid JSON'
          : `API returned HTTP ${response.status}`,
      );
    }
    if (!response.ok) {
      if (
        !signal.aborted &&
        response.status === 401 &&
        path !== '/api/v1/auth/login'
      )
        window.dispatchEvent(new Event('cloudops:unauthorized'));
      const error =
        data && typeof data === 'object' && 'error' in data ? data.error : null;
      if (
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof error.message === 'string'
      ) {
        throw new ApiError(
          response.status,
          'code' in error && typeof error.code === 'string'
            ? error.code
            : 'API_ERROR',
          error.message,
        );
      }
      throw new ApiError(
        response.status,
        'API_ERROR',
        `API returned HTTP ${response.status}`,
      );
    }
    return data as T;
  } catch (error) {
    if (timeout.aborted && !options.signal?.aborted)
      throw new Error('API request timed out');
    throw error;
  }
}
function requestOptions(signal?: AbortSignal): RequestInit {
  return signal ? { signal } : {};
}
export async function getHealth(signal: AbortSignal): Promise<HealthResponse> {
  const data = await apiRequest<HealthResponse>('/api/v1/health', { signal });
  if (!data || data.status !== 'ok' || typeof data.service !== 'string')
    throw new Error('API returned an invalid health response');
  return data;
}
export async function getProducts(
  query: ProductQuery,
  signal?: AbortSignal,
): Promise<PaginatedResult<Product>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== '') params.set(key, String(value));
  return await apiRequest<PaginatedResult<Product>>(
    `/api/v1/products?${params}`,
    requestOptions(signal),
  );
}
export async function getProduct(
  id: string,
  signal?: AbortSignal,
): Promise<Product> {
  return (
    await apiRequest<{ data: Product }>(
      `/api/v1/products/${encodeURIComponent(id)}`,
      requestOptions(signal),
    )
  ).data;
}
export async function getCategories(signal?: AbortSignal): Promise<Category[]> {
  return (
    await apiRequest<{ data: Category[] }>(
      '/api/v1/categories',
      requestOptions(signal),
    )
  ).data;
}
export async function createProduct(
  input: CreateProductInput,
  signal?: AbortSignal,
): Promise<Product> {
  return (
    await apiRequest<{ data: Product }>('/api/v1/products', {
      ...requestOptions(signal),
      method: 'POST',
      body: JSON.stringify(input),
    })
  ).data;
}
export async function updateProduct(
  id: string,
  input: UpdateProductInput,
  signal?: AbortSignal,
): Promise<Product> {
  return (
    await apiRequest<{ data: Product }>(
      `/api/v1/products/${encodeURIComponent(id)}`,
      {
        ...requestOptions(signal),
        method: 'PATCH',
        body: JSON.stringify(input),
      },
    )
  ).data;
}
export async function deleteProduct(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await apiRequest<void>(`/api/v1/products/${encodeURIComponent(id)}`, {
    ...requestOptions(signal),
    method: 'DELETE',
  });
}

export async function getContents(
  query: import('./types').ContentQuery,
  administration: boolean,
  signal: AbortSignal,
): Promise<PaginatedResult<import('./types').Content>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== '') params.set(key, String(value));
  return apiRequest(
    `/api/v1/${administration ? 'admin/' : ''}content?${params}`,
    { signal },
  );
}
export async function getContent(
  slug: string,
  signal: AbortSignal,
): Promise<import('./types').Content> {
  return (
    await apiRequest<{ data: import('./types').Content }>(
      `/api/v1/content/${encodeURIComponent(slug)}`,
      { signal },
    )
  ).data;
}
export async function saveContent(
  id: string | null,
  input: import('./types').CreateContentInput,
  signal: AbortSignal,
): Promise<import('./types').Content> {
  return (
    await apiRequest<{ data: import('./types').Content }>(
      `/api/v1/admin/content${id ? '/' + encodeURIComponent(id) : ''}`,
      { method: id ? 'PATCH' : 'POST', body: JSON.stringify(input), signal },
    )
  ).data;
}
export async function mutateContent(
  id: string,
  action: 'publish' | 'archive' | 'delete',
  signal: AbortSignal,
): Promise<void> {
  await apiRequest(
    `/api/v1/admin/content/${encodeURIComponent(id)}${action === 'delete' ? '' : '/' + action}`,
    { method: action === 'delete' ? 'DELETE' : 'POST', signal },
  );
}

export async function getActivity(
  query: import('./types').ActivityQuery,
  signal: AbortSignal,
): Promise<import('./types').ActivityPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined) params.set(key, String(value));
  return apiRequest(`/api/v1/admin/activity?${params}`, { signal });
}
