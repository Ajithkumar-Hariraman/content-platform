import { Link, useParams } from 'react-router-dom';
import { useContent } from '../query/hooks';
import type { Content } from '../types';
export function ContentDetailPage() {
  const { slug } = useParams();
  const listing = useContent(slug ?? '');
  const content: Content | undefined = listing.data;
  const loading = listing.isPending;
  const error = listing.error?.message ?? '';
  return (
    <>
      <Link to="/content">All content</Link>
      {loading ? (
        <p role="status">Loading content…</p>
      ) : error ? (
        <p role="alert" className="failure">
          {error}
        </p>
      ) : (
        content && (
          <article>
            <h1>{content.title}</h1>
            {content.publishedAt && (
              <p>
                Published{' '}
                <time dateTime={content.publishedAt}>
                  {new Date(content.publishedAt).toLocaleDateString()}
                </time>
              </p>
            )}
            {content.summary && <p>{content.summary}</p>}
            <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {content.body}
            </div>
          </article>
        )
      )}
    </>
  );
}
