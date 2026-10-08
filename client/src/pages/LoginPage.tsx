import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await auth.login(email, password);
      setPassword('');
      navigate('/admin/content', { replace: true });
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Unable to sign in',
      );
      setPassword('');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h1>Sign in</h1>
      <form onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy}>
          <label>
            Email
            <input
              type="email"
              required
              autoComplete="username"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="failure">
              {error}
            </p>
          )}
          <button>{busy ? 'Signing in…' : 'Sign in'}</button>
        </fieldset>
      </form>
    </section>
  );
}
