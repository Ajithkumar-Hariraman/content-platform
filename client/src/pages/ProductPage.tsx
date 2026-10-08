import { useProducts, useCategories, useRecordMutation } from '../query/hooks';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useEffect, useRef, useState } from 'react';
import { deleteProduct } from '../api';
import { ProductFilters } from '../components/ProductFilters';
import { ProductTable } from '../components/ProductTable';
import { ProductForm } from '../components/ProductForm';
import type {
  Category,
  PaginatedResult,
  Product,
  ProductQuery,
} from '../types';

interface Props {
  administration: boolean;
}
export function ProductPage({ administration }: Props) {
  const { permissions } = useAuth();
  const canWrite = administration && permissions.includes('PRODUCT_WRITE');
  const canDelete = administration && permissions.includes('PRODUCT_DELETE');
  const { notify } = useNotifications();
  const categoryQuery = useCategories();
  const categories: Category[] = categoryQuery.data ?? [];
  const categoryError = categoryQuery.error?.message ?? '';
  const [query, setQuery] = useState<ProductQuery>({
    page: 1,
    limit: 10,
    sort: 'createdAt',
    order: 'desc',
  });
  const [editor, setEditor] = useState<{ product: Product | null } | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState('');
  const debouncedSearch = useDebouncedValue(query.search ?? '');
  const { page } = query;
  const deletion = useRef<AbortController | null>(null);
  useEffect(() => () => deletion.current?.abort(), []);
  const listing = useProducts(
    { ...query, search: debouncedSearch },
    (query.search ?? '') === debouncedSearch,
  );
  const result: PaginatedResult<Product> | undefined = listing.data;
  const loading = listing.isPending;
  const error = listing.error?.message ?? '';
  useEffect(() => {
    if (result && page > Math.max(1, result.pagination.totalPages))
      setQuery((previous) => ({
        ...previous,
        page: Math.max(1, result.pagination.totalPages),
      }));
  }, [result, page]);
  const deleteMutation = useRecordMutation(
    'products',
    ({ id, signal }: { id: string; signal: AbortSignal }) =>
      deleteProduct(id, signal),
  );
  function saved(product: Product) {
    setEditor(null);
    notify(
      'success',
      `${editor?.product ? 'Product updated' : 'Product created'}: ${product.name}`,
    );
  }
  async function remove(product: Product) {
    if (!window.confirm(`Delete “${product.name}”? This cannot be undone.`))
      return;
    const controller = new AbortController();
    deletion.current = controller;
    setDeletingId(product.id);
    setMutationError('');

    try {
      await deleteMutation.mutateAsync({
        id: product.id,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (editor?.product?.id === product.id) setEditor(null);
      notify('success', `Product deleted: ${product.name}`);
    } catch (failure) {
      if (!controller.signal.aborted)
        setMutationError(
          failure instanceof Error
            ? failure.message
            : 'Unable to delete product',
        );
    } finally {
      if (!controller.signal.aborted) setDeletingId(null);
    }
  }
  return (
    <>
      <header>
        <p className="eyebrow">Catalog</p>
        <h1>{administration ? 'Product administration' : 'Products'}</h1>
        <p>
          {administration
            ? 'Create and maintain the product catalog.'
            : 'Browse products by category and availability.'}
        </p>
      </header>
      {mutationError && (
        <p role="alert" className="failure">
          {mutationError}
        </p>
      )}
      {categoryError && (
        <p role="alert" className="failure">
          Categories: {categoryError}{' '}
          <button
            className="secondary"
            onClick={() => void categoryQuery.refetch()}
          >
            Retry categories
          </button>
        </p>
      )}
      {canWrite && (
        <button
          disabled={
            !categories.length || deletingId !== null || editor !== null
          }
          onClick={() => {
            setEditor({ product: null });
          }}
        >
          Create product
        </button>
      )}
      {editor && (
        <ProductForm
          key={editor.product?.id ?? 'new'}
          categories={categories}
          product={editor.product}
          onSaved={saved}
          onCancel={() => setEditor(null)}
        />
      )}
      <section aria-labelledby="products-title">
        <h2 id="products-title">Product catalog</h2>
        <ProductFilters
          categories={categories}
          query={query}
          onChange={setQuery}
        />
        {loading ? (
          <p role="status">Loading products…</p>
        ) : error ? (
          <div role="alert">
            <p className="failure">{error}</p>
            <button onClick={() => void listing.refetch()}>Retry</button>
          </div>
        ) : (
          result && (
            <>
              <ProductTable
                result={result}
                canWrite={canWrite}
                canDelete={canDelete}
                administration={administration}
                actionsDisabled={deletingId !== null || editor !== null}
                deletingId={deletingId}
                onEdit={(product) => {
                  setEditor({ product });
                }}
                onDelete={(product) => {
                  void remove(product);
                }}
                onPage={(page) =>
                  setQuery((previous) => ({ ...previous, page }))
                }
              />
            </>
          )
        )}
      </section>
    </>
  );
}
