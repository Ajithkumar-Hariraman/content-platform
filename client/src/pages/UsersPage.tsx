import { useUsers, useRecordMutation } from '../query/hooks';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiRequest } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import type { AuthUser, Role, PaginatedResult } from '../types';
export function UsersPage() {
  const auth = useAuth();
  const { notify } = useNotifications();
  const [page, setPage] = useState(1);
  const listing = useUsers(auth.user?.id ?? '', page);
  const result: PaginatedResult<AuthUser> | undefined = listing.data;
  const loading = listing.isPending;
  const error = listing.error?.message ?? '';
  const userMutation = useRecordMutation(
    'users',
    ({
      path,
      body,
      method,
      signal,
    }: {
      path: string;
      body: unknown;
      method: 'POST' | 'PATCH';
      signal: AbortSignal;
    }) => apiRequest(path, { method, body: JSON.stringify(body), signal }),
  );
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{
    email: string;
    password: string;
    role: Role;
  }>({ email: '', password: '', role: 'VIEWER' });
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => () => mutation.current?.abort(), []);
  async function change(
    path: string,
    body: unknown,
    method: 'POST' | 'PATCH',
    self = false,
  ) {
    if (busy) return;
    const controller = new AbortController();
    mutation.current = controller;
    setBusy(true);
    try {
      await userMutation.mutateAsync({
        path,
        body,
        method,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      notify('success', 'User saved');
      setForm({ email: '', password: '', role: 'VIEWER' });

      if (self) auth.refresh();
    } catch (failure) {
      if (!controller.signal.aborted)
        notify(
          'error',
          failure instanceof Error ? failure.message : 'Unable to save user',
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void change('/api/v1/admin/users', form, 'POST');
  }
  return (
    <>
      <h1>User administration</h1>
      <section>
        <h2>Create user</h2>
        <form onSubmit={create}>
          <fieldset disabled={busy}>
            <label>
              Email
              <input
                type="email"
                required
                maxLength={254}
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label>
              Initial password
              <input
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
            <label>
              Role
              <select
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value as Role })
                }
              >
                <option>VIEWER</option>
                <option>EDITOR</option>
                <option>ADMIN</option>
              </select>
            </label>
            <button>Create user</button>
          </fieldset>
        </form>
      </section>
      <section>
        {loading ? (
          <p role="status">Loading users…</p>
        ) : error ? (
          <div role="alert">
            <p className="failure">{error}</p>
            <button onClick={() => void listing.refetch()}>Retry</button>
          </div>
        ) : (
          result && (
            <>
              {result.data.length === 0 ? (
                <p>No users found.</p>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.map((user) => (
                        <tr key={user.id}>
                          <td>{user.email}</td>
                          <td>
                            <select
                              aria-label={`Role for ${user.email}`}
                              value={user.role}
                              disabled={busy}
                              onChange={(e) =>
                                void change(
                                  `/api/v1/admin/users/${user.id}/role`,
                                  { role: e.target.value },
                                  'PATCH',
                                  user.id === auth.user?.id,
                                )
                              }
                            >
                              <option>VIEWER</option>
                              <option>EDITOR</option>
                              <option>ADMIN</option>
                            </select>
                          </td>
                          <td>
                            {user.status}{' '}
                            <button
                              disabled={busy}
                              onClick={() =>
                                void change(
                                  `/api/v1/admin/users/${user.id}/status`,
                                  {
                                    status:
                                      user.status === 'ACTIVE'
                                        ? 'DISABLED'
                                        : 'ACTIVE',
                                  },
                                  'PATCH',
                                  user.id === auth.user?.id,
                                )
                              }
                            >
                              {user.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="pagination">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {Math.max(1, result.pagination.totalPages)}
                </span>
                <button
                  disabled={page >= result.pagination.totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </button>
              </div>
            </>
          )
        )}
      </section>
    </>
  );
}
