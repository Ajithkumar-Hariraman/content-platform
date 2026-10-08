import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, apiRequest, setCsrfToken } from '../api';
import type { AuthUser, Permission, AuthSession } from '../types';
interface AuthContextValue {
  user: AuthUser | null;
  authenticated: boolean;
  permissions: Permission[];
  loading: boolean;
  error: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => void;
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const version = useRef(0);
  const bootstrap = useRef<AbortController | null>(null);
  function clear() {
    version.current++;
    setSession(null);
    setCsrfToken(null);
  }
  function apply(data: AuthSession) {
    setSession(data);
    setCsrfToken(data.csrfToken);
    setError('');
  }
  useEffect(() => {
    const controller = new AbortController();
    bootstrap.current = controller;
    const current = ++version.current;
    setLoading(true);
    setError('');
    void apiRequest<AuthSession>('/api/v1/auth/me', {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted && current === version.current)
          apply(data);
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted || current !== version.current) return;
        setSession(null);
        setCsrfToken(null);
        if (!(failure instanceof ApiError && failure.status === 401))
          setError(
            failure instanceof Error
              ? failure.message
              : 'Authentication unavailable',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted && current === version.current)
          setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    const expired = () => {
      clear();
      setLoading(false);
    };
    window.addEventListener('cloudops:unauthorized', expired);
    return () => window.removeEventListener('cloudops:unauthorized', expired);
  }, []);
  async function login(email: string, password: string) {
    const current = ++version.current;
    bootstrap.current?.abort();
    setLoading(false);
    const data = await apiRequest<AuthSession>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (current === version.current) {
      apply(data);
      setLoading(false);
    }
  }
  async function logout() {
    const current = ++version.current;
    bootstrap.current?.abort();
    await apiRequest<void>('/api/v1/auth/logout', { method: 'POST' });
    if (current === version.current) {
      clear();
      setLoading(false);
    }
  }
  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        authenticated: session !== null,
        permissions: session?.permissions ?? [],
        loading,
        error,
        login,
        logout,
        refresh: () => setAttempt((value) => value + 1),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth requires AuthProvider');
  return context;
}
