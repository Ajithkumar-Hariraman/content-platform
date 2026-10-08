import { useRecordMutation } from '../query/hooks';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createProduct, updateProduct } from '../api';
import type {
  Category,
  CreateProductInput,
  Product,
  ProductStatus,
} from '../types';

interface FormState {
  name: string;
  slug: string;
  description: string;
  price: string;
  status: ProductStatus;
  categoryId: string;
}
interface Props {
  categories: Category[];
  product: Product | null;
  onSaved: (product: Product) => void;
  onCancel: () => void;
}

export function ProductForm({ categories, product, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<FormState>({
    name: product?.name ?? '',
    slug: product?.slug ?? '',
    description: product?.description ?? '',
    price: product?.price ?? '',
    status: product?.status ?? 'DRAFT',
    categoryId: product?.categoryId ?? categories[0]?.id ?? '',
  });
  const saveMutation = useRecordMutation(
    'products',
    ({ input, signal }: { input: CreateProductInput; signal: AbortSignal }) =>
      product
        ? updateProduct(product.id, input, signal)
        : createProduct(input, signal),
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (
      !form.name.trim() ||
      !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(form.slug) ||
      !/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(form.price) ||
      !form.categoryId
    ) {
      setError(
        'Enter a name, a lowercase hyphenated slug, a nonnegative price with at most two decimal places, and a category.',
      );
      return;
    }
    const input: CreateProductInput = {
      ...form,
      name: form.name.trim(),
      description: form.description || null,
    };
    const controller = new AbortController();
    request.current = controller;
    setSubmitting(true);
    try {
      const saved = await saveMutation.mutateAsync({
        input,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) onSaved(saved);
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          failure instanceof Error ? failure.message : 'Unable to save product',
        );
    } finally {
      if (!controller.signal.aborted) setSubmitting(false);
    }
  }
  return (
    <section aria-labelledby="form-title">
      <h2 id="form-title">{product ? 'Edit product' : 'Create product'}</h2>
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <fieldset disabled={submitting}>
          <div className="form-grid">
            <label>
              Name
              <input
                required
                maxLength={200}
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
              />
            </label>
            <label>
              Slug
              <input
                required
                maxLength={200}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                value={form.slug}
                onChange={(event) => update('slug', event.target.value)}
              />
            </label>
            <label>
              Price
              <input
                required
                inputMode="decimal"
                placeholder="0.00"
                value={form.price}
                onChange={(event) => update('price', event.target.value)}
              />
            </label>
            <label>
              Status
              <select
                value={form.status}
                onChange={(event) =>
                  update('status', event.target.value as ProductStatus)
                }
              >
                <option>DRAFT</option>
                <option>ACTIVE</option>
                <option>INACTIVE</option>
              </select>
            </label>
            <label>
              Category
              <select
                required
                value={form.categoryId}
                onChange={(event) => update('categoryId', event.target.value)}
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="full-width">
              Description
              <textarea
                maxLength={5000}
                rows={4}
                value={form.description}
                onChange={(event) => update('description', event.target.value)}
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="failure">
              {error}
            </p>
          )}
          <div className="actions">
            <button type="submit">
              {submitting ? 'Saving…' : 'Save product'}
            </button>
            <button className="secondary" type="button" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
