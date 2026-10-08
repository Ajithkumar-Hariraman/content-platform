import { lazy, Suspense, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from './query/client';
import { PrivacyBoundary } from './query/PrivacyBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RequireAuth } from './components/RequireAuth';
const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })),
);
const UsersPage = lazy(() =>
  import('./pages/UsersPage').then((module) => ({ default: module.UsersPage })),
);
const AccountPage = lazy(() =>
  import('./pages/AccountPage').then((module) => ({
    default: module.AccountPage,
  })),
);
const ActivityPage = lazy(() =>
  import('./pages/ActivityPage').then((module) => ({
    default: module.ActivityPage,
  })),
);
import {
  BrowserRouter,
  NavLink,
  Outlet,
  Route,
  Routes,
} from 'react-router-dom';
import { NotificationProvider } from './context/NotificationContext';
import { HomePage } from './pages/HomePage';
const ProductPage = lazy(() =>
  import('./pages/ProductPage').then((module) => ({
    default: module.ProductPage,
  })),
);
const ProductDetailPage = lazy(() =>
  import('./pages/ProductDetailPage').then((module) => ({
    default: module.ProductDetailPage,
  })),
);
const ContentPage = lazy(() =>
  import('./pages/ContentPage').then((module) => ({
    default: module.ContentPage,
  })),
);
const ContentDetailPage = lazy(() =>
  import('./pages/ContentDetailPage').then((module) => ({
    default: module.ContentDetailPage,
  })),
);
function Layout() {
  const auth = useAuth();
  const [logoutError, setLogoutError] = useState('');
  return (
    <>
      <nav aria-label="Main navigation">
        <NavLink to="/" end>
          CloudOps
        </NavLink>
        <NavLink to="/products">Products</NavLink>
        <NavLink to="/content">Content</NavLink>
        <NavLink to="/admin/products">Product administration</NavLink>
        <NavLink to="/admin/content">Content administration</NavLink>
        <NavLink to="/admin/activity">Activity</NavLink>
        {auth.permissions.includes('USER_READ') && (
          <NavLink to="/admin/users">Users</NavLink>
        )}
        {auth.authenticated ? (
          <>
            <NavLink to="/account">Account</NavLink>
            <button
              onClick={() =>
                void auth
                  .logout()
                  .catch((failure: unknown) =>
                    setLogoutError(
                      failure instanceof Error
                        ? failure.message
                        : 'Unable to sign out',
                    ),
                  )
              }
            >
              Sign out
            </button>
          </>
        ) : (
          <NavLink to="/login">Sign in</NavLink>
        )}
      </nav>
      {logoutError && <p role="alert">{logoutError}</p>}

      <main>
        <Suspense fallback={<p role="status">Loading page…</p>}>
          <Outlet />
        </Suspense>
      </main>
    </>
  );
}
export function App() {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <NotificationProvider>
          <AuthProvider>
            <PrivacyBoundary>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<HomePage />} />
                  <Route path="login" element={<LoginPage />} />
                  <Route element={<RequireAuth />}>
                    <Route path="account" element={<AccountPage />} />
                  </Route>
                  <Route element={<RequireAuth permission="USER_READ" />}>
                    <Route path="admin/users" element={<UsersPage />} />
                  </Route>
                  <Route
                    path="products"
                    element={
                      <ProductPage
                        key="public-products"
                        administration={false}
                      />
                    }
                  />
                  <Route path="products/:id" element={<ProductDetailPage />} />
                  <Route element={<RequireAuth permission="PRODUCT_READ" />}>
                    <Route
                      path="admin/products"
                      element={
                        <ProductPage key="admin-products" administration />
                      }
                    />
                  </Route>
                  <Route
                    path="content"
                    element={
                      <ContentPage
                        key="public-content"
                        administration={false}
                      />
                    }
                  />
                  <Route path="content/:slug" element={<ContentDetailPage />} />
                  <Route element={<RequireAuth permission="CONTENT_READ" />}>
                    <Route
                      path="admin/content"
                      element={
                        <ContentPage key="admin-content" administration />
                      }
                    />
                  </Route>
                  <Route element={<RequireAuth permission="ACTIVITY_READ" />}>
                    <Route path="admin/activity" element={<ActivityPage />} />
                  </Route>
                  <Route
                    path="*"
                    element={
                      <>
                        <h1>Page not found</h1>
                        <p>Choose a page from the navigation.</p>
                      </>
                    }
                  />
                </Route>
              </Routes>
            </PrivacyBoundary>
          </AuthProvider>
        </NotificationProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
