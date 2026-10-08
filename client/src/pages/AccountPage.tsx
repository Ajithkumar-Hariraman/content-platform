import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
export function AccountPage() {
  const auth = useAuth();
  const { notify } = useNotifications();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest<void>('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      auth.refresh();
      notify('success', 'Password changed. Sign in again.');
      navigate('/login', { replace: true });
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Unable to change password',
      );
      setCurrentPassword('');
      setNewPassword('');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h1>Account</h1>
      <p>
        {auth.user?.email} · {auth.user?.role}
      </p>
      <form onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy}>
          <label>
            Current password
            <input
              type="password"
              required
              maxLength={128}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label>
            New password
            <input
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="failure">
              {error}
            </p>
          )}
          <button>{busy ? 'Changing password…' : 'Change password'}</button>
        </fieldset>
      </form>
    </section>
  );
}
