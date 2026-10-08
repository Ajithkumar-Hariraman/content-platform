import { useContents, useRecordMutation } from '../query/hooks';
import { useAuth } from '../context/AuthContext';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { mutateContent } from '../api';
import { ContentForm } from '../components/ContentForm';
import { useNotifications } from '../context/NotificationContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type {
  Content,
  ContentQuery,
  ContentStatus,
  PaginatedResult,
} from '../types';
export function ContentPage({ administration }: { administration: boolean }) {
  const { permissions, user } = useAuth();
  const canWrite = permissions.includes('CONTENT_WRITE');
  const canPublish = permissions.includes('CONTENT_PUBLISH');
  const canDelete = permissions.includes('CONTENT_DELETE');
  const { notify } = useNotifications();
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search);
  const [query, setQuery] = useState<ContentQuery>({
    page: 1,
    limit: 10,
    sort: administration ? 'createdAt' : 'publishedAt',
    order: 'desc',
  });
  const { page, limit, status, sort, order } = query;
  const [editor, setEditor] = useState<{ content: Content | null } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => () => mutation.current?.abort(), []);
  const listing = useContents(
    {
      page,
      limit,
      sort,
      order,
      search: debounced,
      ...(status ? { status } : {}),
    },
    administration ? user?.id : undefined,
    search === debounced,
  );
  const result: PaginatedResult<Content> | undefined = listing.data;
  const loading = listing.isPending;
  const error = listing.error?.message ?? '';
  useEffect(() => {
    if (result && page > Math.max(1, result.pagination.totalPages))
      setQuery((previous) => ({
        ...previous,
        page: Math.max(1, result.pagination.totalPages),
      }));
  }, [result, page]);
  const contentMutation = useRecordMutation(
    'content',
    ({
      id,
      operation,
      signal,
    }: {
      id: string;
      operation: 'publish' | 'archive' | 'delete';
      signal: AbortSignal;
    }) => mutateContent(id, operation, signal),
  );
  async function action(
    content: Content,
    operation: 'publish' | 'archive' | 'delete',
  ) {
    if (busy) return;
    if (
      operation === 'delete' &&
      !window.confirm(`Delete “${content.title}”? This cannot be undone.`)
    )
      return;
    const controller = new AbortController();
    mutation.current = controller;
    setBusy(true);
    try {
      await contentMutation.mutateAsync({
        id: content.id,
        operation,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        notify(
          'success',
          `Content ${operation === 'publish' ? 'published' : operation === 'archive' ? 'archived' : 'deleted'}`,
        );
      }
    } catch (failure) {
      if (!controller.signal.aborted)
        notify(
          'error',
          failure instanceof Error
            ? failure.message
            : 'Content operation failed',
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <>
      <header>
        <p className="eyebrow">Headless CMS</p>
        <h1>{administration ? 'Content administration' : 'Content'}</h1>
      </header>
      {administration && canWrite && (
        <button
          disabled={busy || editor !== null || !canWrite}
          onClick={() => setEditor({ content: null })}
        >
          Create content
        </button>
      )}
      {editor && (
        <ContentForm
          key={editor.content?.id ?? 'new'}
          content={editor.content}
          onSaved={() => {
            setEditor(null);
          }}
          onCancel={() => setEditor(null)}
        />
      )}
      <section>
        <div className="filters">
          <label>
            Search
            <input
              type="search"
              maxLength={200}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setQuery({ ...query, page: 1 });
              }}
            />
          </label>
          {administration && (
            <label>
              Status
              <select
                value={query.status ?? ''}
                onChange={(e) => {
                  const next = { ...query, page: 1 };
                  if (e.target.value)
                    next.status = e.target.value as ContentStatus;
                  else delete next.status;
                  setQuery(next);
                }}
              >
                <option value="">All statuses</option>
                <option>DRAFT</option>
                <option>PUBLISHED</option>
                <option>ARCHIVED</option>
              </select>
            </label>
          )}
          <label>
            Sort
            <select
              value={`${query.sort}:${query.order}`}
              onChange={(e) => {
                const [sort, order] = e.target.value.split(':');
                setQuery({
                  ...query,
                  page: 1,
                  sort: sort as ContentQuery['sort'],
                  order: order as ContentQuery['order'],
                });
              }}
            >
              {administration && (
                <option value="createdAt:desc">Newest created</option>
              )}
              <option value="publishedAt:desc">Newest published</option>
              <option value="title:asc">Title A–Z</option>
            </select>
          </label>
        </div>
        {loading ? (
          <p role="status">Loading content…</p>
        ) : error ? (
          <div role="alert">
            <p className="failure">{error}</p>
            <button onClick={() => void listing.refetch()}>Retry</button>
          </div>
        ) : (
          result && (
            <>
              {result.data.length === 0 ? (
                <p>No content matches these filters.</p>
              ) : (
                result.data.map((content) => (
                  <article key={content.id}>
                    <h2>
                      {administration ? (
                        content.title
                      ) : (
                        <Link to={`/content/${content.slug}`}>
                          {content.title}
                        </Link>
                      )}
                    </h2>
                    {content.summary && <p>{content.summary}</p>}
                    {content.publishedAt && (
                      <p>
                        Published{' '}
                        <time dateTime={content.publishedAt}>
                          {new Date(content.publishedAt).toLocaleDateString()}
                        </time>
                      </p>
                    )}
                    {administration && (
                      <>
                        <p>{content.status}</p>
                        <div className="actions">
                          <button
                            disabled={busy || editor !== null || !canWrite}
                            onClick={() => setEditor({ content })}
                          >
                            Edit
                          </button>
                          <button
                            disabled={
                              busy ||
                              editor !== null ||
                              content.status === 'ARCHIVED' ||
                              !canPublish
                            }
                            onClick={() => void action(content, 'publish')}
                          >
                            Publish
                          </button>
                          <button
                            disabled={
                              busy ||
                              editor !== null ||
                              content.status === 'ARCHIVED' ||
                              !canPublish
                            }
                            onClick={() => void action(content, 'archive')}
                          >
                            Archive
                          </button>
                          <button
                            className="danger"
                            disabled={busy || editor !== null || !canDelete}
                            onClick={() => void action(content, 'delete')}
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                ))
              )}
              <div className="pagination">
                <button
                  disabled={query.page <= 1}
                  onClick={() => setQuery({ ...query, page: query.page - 1 })}
                >
                  Previous
                </button>
                <span>
                  Page {result.pagination.page} of{' '}
                  {Math.max(1, result.pagination.totalPages)} ·{' '}
                  {result.pagination.total} items
                </span>
                <button
                  disabled={query.page >= result.pagination.totalPages}
                  onClick={() => setQuery({ ...query, page: query.page + 1 })}
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
