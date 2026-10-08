import { useEffect, useState } from 'react';
import { getHealth, type HealthResponse } from '../api';

type HealthState =
  | { status: 'loading' }
  | { status: 'success'; data: HealthResponse }
  | { status: 'failure'; message: string };

export function HomePage() {
  const [health, setHealth] = useState<HealthState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new Error('API request timed out')),
      10000,
    );
    setHealth({ status: 'loading' });
    void getHealth(controller.signal)
      .then((data) => {
        if (active) setHealth({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setHealth({
          status: 'failure',
          message:
            error instanceof Error ? error.message : 'API request failed',
        });
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);
  return (
    <>
      <header>
        <p className="eyebrow">CloudOps</p>
        <h1>Content Platform</h1>
        <p>A foundation for reliable content and product operations.</p>
      </header>
      <section aria-labelledby="health-title">
        <h2 id="health-title">API health</h2>
        <div role="status" aria-live="polite">
          {health.status === 'loading' && <p>Checking API availability…</p>}
          {health.status === 'success' && (
            <>
              <p className="success">API is available</p>
              <p>
                Service: <code>{health.data.service}</code>
              </p>
            </>
          )}
          {health.status === 'failure' && (
            <>
              <p className="failure">Unable to reach the API</p>
              <p>{health.message}</p>
            </>
          )}
        </div>
        <button
          disabled={health.status === 'loading'}
          onClick={() => setAttempt((value) => value + 1)}
        >
          Check again
        </button>
      </section>
    </>
  );
}
