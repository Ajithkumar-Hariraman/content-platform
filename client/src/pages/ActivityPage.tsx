import { useState, type FormEvent } from 'react';
import { useActivity } from '../query/hooks';
import { useAuth } from '../context/AuthContext';
import type {
  ActivityPage as ActivityResult,
  ActivityQuery,
  ActivityEntityType,
} from '../types';
export function ActivityPage() {
  const [query, setQuery] = useState<ActivityQuery>({ limit: 20 });
  const [entityType, setEntityType] = useState<ActivityEntityType>('CONTENT');
  const [entityId, setEntityId] = useState('');
  const { user } = useAuth();
  const listing = useActivity(user?.id ?? '', query);
  const result: ActivityResult | undefined = listing.data;
  const loading = listing.isPending;
  const error = listing.error?.message ?? '';
  const [previousCursors, setPreviousCursors] = useState<
    (string | undefined)[]
  >([]);
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPreviousCursors([]);
    setQuery({
      limit: 20,
      ...(entityId.trim() ? { entityType, entityId: entityId.trim() } : {}),
    });
  }
  return (
    <>
      <header>
        <p className="eyebrow">Operations</p>
        <h1>Activity</h1>
        <p>
          Recent Product and Content changes. Delivery may be delayed while
          activity storage recovers.
        </p>
      </header>
      <section>
        <form className="filters" onSubmit={filter}>
          <label>
            Entity type
            <select
              value={entityType}
              onChange={(e) =>
                setEntityType(e.target.value as ActivityEntityType)
              }
            >
              <option>CONTENT</option>
              <option>PRODUCT</option>
            </select>
          </label>
          <label>
            Entity ID
            <input
              value={entityId}
              maxLength={36}
              pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
              placeholder="UUID; leave empty for all activity"
              onChange={(e) => setEntityId(e.target.value)}
            />
          </label>
          <button type="submit">Apply</button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setEntityId('');
              setPreviousCursors([]);
              setQuery({ limit: 20 });
            }}
          >
            Reset
          </button>
          <button
            type="button"
            className="secondary"
            disabled={loading}
            onClick={() => {
              void listing.refetch();
              setPreviousCursors([]);
              setQuery(({ limit, entityType, entityId }) => ({
                limit,
                ...(entityType ? { entityType } : {}),
                ...(entityId ? { entityId } : {}),
              }));
            }}
          >
            Refresh
          </button>
        </form>
        {loading ? (
          <p role="status">Loading activity…</p>
        ) : error ? (
          <div role="alert">
            <p className="failure">{error}</p>
            <button onClick={() => void listing.refetch()}>Retry</button>
          </div>
        ) : (
          result && (
            <>
              {result.data.length === 0 ? (
                <p>No activity found.</p>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Entity</th>
                        <th>Identifier</th>
                        <th>Timestamp</th>
                        <th>Actor</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.map((item) => (
                        <tr key={item.id}>
                          <td>{item.eventType}</td>
                          <td>{item.entityType}</td>
                          <td>
                            <code>{item.entityId}</code>
                          </td>
                          <td>
                            <time dateTime={item.occurredAt}>
                              {new Date(item.occurredAt).toLocaleString()}
                            </time>
                          </td>
                          <td>
                            {item.actor.kind === 'USER'
                              ? item.actor.id
                              : item.actor.kind}
                          </td>
                          <td>
                            {item.data.changedFields?.join(', ') ??
                              item.data.slug ??
                              item.data.status ??
                              '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="pagination">
                <button
                  disabled={previousCursors.length === 0}
                  onClick={() => {
                    const cursor = previousCursors.at(-1);
                    const next = { ...query };
                    if (cursor) next.cursor = cursor;
                    else delete next.cursor;
                    setQuery(next);
                    setPreviousCursors((previous) => previous.slice(0, -1));
                  }}
                >
                  Previous
                </button>
                <span>Page {previousCursors.length + 1}</span>
                <button
                  disabled={!result.nextCursor}
                  onClick={() => {
                    if (!result.nextCursor) return;
                    setPreviousCursors((previous) => [
                      ...previous,
                      query.cursor,
                    ]);
                    setQuery({ ...query, cursor: result.nextCursor });
                  }}
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
