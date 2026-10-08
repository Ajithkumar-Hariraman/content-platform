import { afterEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AuthProvider } from '../context/AuthContext';
import { NotificationProvider } from '../context/NotificationContext';
import { LoginPage } from '../pages/LoginPage';
import { RequireAuth } from '../components/RequireAuth';
import { ProductPage } from '../pages/ProductPage';
import { ContentPage } from '../pages/ContentPage';
import { ProductForm } from '../components/ProductForm';
import { PrivacyBoundary } from '../query/PrivacyBoundary';
import { queryKeys } from '../query/keys';
import type { Category, Content, Product, AuthSession } from '../types';
const category: Category = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Infrastructure',
  slug: 'infrastructure',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};
const product: Product = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'Compute service',
  slug: 'compute-service',
  description: null,
  price: '12.00',
  status: 'ACTIVE',
  categoryId: category.id,
  category: { id: category.id, name: category.name, slug: category.slug },
  createdAt: category.createdAt,
  updatedAt: category.updatedAt,
};
const content: Content = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  title: 'Reliable APIs',
  slug: 'reliable-apis',
  summary: 'Operational guidance',
  body: 'Plain text',
  status: 'PUBLISHED',
  publishedAt: '2026-01-01T00:00:00Z',
  createdAt: category.createdAt,
  updatedAt: category.updatedAt,
};
const session: AuthSession = {
  user: {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    email: 'admin@example.test',
    role: 'ADMIN',
    status: 'ACTIVE',
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  },
  permissions: ['PRODUCT_READ', 'PRODUCT_WRITE', 'USER_READ'],
  csrfToken: 'csrf-test',
};
const pagination = { page: 1, limit: 10, total: 1, totalPages: 1 };
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
function mockApi(
  handler?: (path: string, init?: RequestInit) => Response | Promise<Response>,
) {
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (handler) return handler(path, init);
    if (path === '/api/v1/auth/me')
      return json(
        { error: { code: 'UNAUTHENTICATED', message: 'Sign in' } },
        401,
      );
    if (path === '/api/v1/categories') return json({ data: [category] });
    if (path.startsWith('/api/v1/products?'))
      return json({ data: [product], pagination });
    if (path.startsWith('/api/v1/content?'))
      return json({ data: [content], pagination });
    throw new Error(`Unexpected API request ${path}`);
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
function mount(children: ReactNode, path = '/') {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 30000 },
      mutations: { retry: false },
    },
  });
  const rendered = render(
    <QueryClientProvider client={client}>
      <NotificationProvider>
        <AuthProvider>
          <PrivacyBoundary>
            <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
          </PrivacyBoundary>
        </AuthProvider>
      </NotificationProvider>
    </QueryClientProvider>,
  );
  return { client, ...rendered };
}
afterEach(() => vi.unstubAllGlobals());
it('login sends credentials and reaches a protected route after authentication', async () => {
  mockApi((path) =>
    path === '/api/v1/auth/login'
      ? json(session)
      : json({ error: { message: 'Sign in' } }, 401),
  );
  mount(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/admin/content" element={<h1>Protected content</h1>} />
      </Route>
    </Routes>,
    '/login',
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), 'admin@example.test');
  await user.type(screen.getByLabelText('Password'), 'test-only-password');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText('Protected content')).toBeTruthy();
});
it('redirects anonymous admin visitors to login', async () => {
  mockApi();
  mount(
    <Routes>
      <Route element={<RequireAuth permission="PRODUCT_READ" />}>
        <Route path="/admin/products" element={<p>Private products</p>} />
      </Route>
      <Route path="/login" element={<LoginPage />} />
    </Routes>,
    '/admin/products',
  );
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
  expect(screen.queryByText('Private products')).toBeNull();
});
it('loads products and categories through Query without duplicate requests', async () => {
  const fetch = mockApi();
  mount(<ProductPage administration={false} />);
  expect(screen.getByText('Loading products…')).toBeTruthy();
  expect(await screen.findByText('Compute service')).toBeTruthy();
  expect(
    fetch.mock.calls.filter(([path]) =>
      String(path).startsWith('/api/v1/products?'),
    ),
  ).toHaveLength(1);
});
it('loads content and keeps loading visible until delivery', async () => {
  let resolve: ((value: Response) => void) | undefined;
  mockApi((path) =>
    path.startsWith('/api/v1/content?')
      ? new Promise<Response>((done) => {
          resolve = done;
        })
      : json({ error: { message: 'Sign in' } }, 401),
  );
  mount(<ContentPage administration={false} />);
  expect(screen.getByText('Loading content…')).toBeTruthy();
  await waitFor(() => expect(resolve).toBeDefined());
  resolve!(json({ data: [content], pagination }));
  expect(
    await screen.findByRole('link', { name: 'Reliable APIs' }),
  ).toBeTruthy();
});
it('shows query failure and retries explicitly', async () => {
  let failed = true;
  mockApi((path) =>
    path.startsWith('/api/v1/content?')
      ? failed
        ? json({ error: { message: 'Content unavailable' } }, 503)
        : json({ data: [content], pagination })
      : json({ error: { message: 'Sign in' } }, 401),
  );
  mount(<ContentPage administration={false} />);
  expect(await screen.findByText('Content unavailable')).toBeTruthy();
  failed = false;
  await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Reliable APIs')).toBeTruthy();
});
it('successful product mutation invalidates list/detail queries and calls the form callback', async () => {
  mockApi((path) =>
    path === '/api/v1/auth/me' ? json(session) : json({ data: product }, 201),
  );
  const saved = vi.fn();
  const { client } = mount(
    <ProductForm
      product={null}
      categories={[category]}
      onSaved={saved}
      onCancel={() => {}}
    />,
  );
  const key = queryKeys.products({
    page: 1,
    limit: 10,
    sort: 'createdAt',
    order: 'desc',
  });
  client.setQueryData(key, {
    data: [],
    pagination: { ...pagination, total: 0 },
  });
  client.setQueryData(queryKeys.product(product.id), product);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Name'), 'Compute service');
  await user.type(screen.getByLabelText('Slug'), 'compute-service');
  await user.type(screen.getByLabelText('Price'), '12.00');
  await user.click(screen.getByRole('button', { name: 'Save product' }));
  await waitFor(() => expect(saved).toHaveBeenCalledWith(product));
  expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  expect(
    client.getQueryState(queryKeys.product(product.id))?.isInvalidated,
  ).toBe(true);
});
