import { Link, useParams } from 'react-router-dom';
import { useProduct } from '../query/hooks';
import type { Product } from '../types';
export function ProductDetailPage() {
  const { id } = useParams();
  const listing = useProduct(id ?? '');
  const product: Product | undefined = listing.data;
  const loading = listing.isPending;
  const error = listing.error?.message ?? '';
  return (
    <>
      <Link to="/products">All products</Link>
      {loading ? (
        <p role="status">Loading product…</p>
      ) : error ? (
        <p role="alert" className="failure">
          {error}
        </p>
      ) : (
        product && (
          <article>
            <h1>{product.name}</h1>
            <p>{product.description}</p>
            <p>
              {product.category.name} · {product.price} · {product.status}
            </p>
          </article>
        )
      )}
    </>
  );
}
