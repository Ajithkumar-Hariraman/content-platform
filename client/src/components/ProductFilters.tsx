import type { Category, ProductQuery, ProductStatus } from '../types';
interface Props {
  categories: Category[];
  query: ProductQuery;
  onChange: (query: ProductQuery) => void;
}
export function ProductFilters({ categories, query, onChange }: Props) {
  return (
    <form
      className="filters"
      onSubmit={(event) => {
        event.preventDefault();
        onChange({ ...query, page: 1, search: query.search?.trim() ?? '' });
      }}
    >
      <label>
        Search
        <input
          type="search"
          maxLength={200}
          value={query.search ?? ''}
          onChange={(event) =>
            onChange({ ...query, page: 1, search: event.target.value })
          }
        />
      </label>
      <button type="submit">Search</button>
      <label>
        Category
        <select
          value={query.categoryId ?? ''}
          disabled={!categories.length}
          onChange={(event) => {
            const next = { ...query, page: 1 };
            if (event.target.value) next.categoryId = event.target.value;
            else delete next.categoryId;
            onChange(next);
          }}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select
          value={query.status ?? ''}
          onChange={(event) => {
            const next = { ...query, page: 1 };
            if (event.target.value)
              next.status = event.target.value as ProductStatus;
            else delete next.status;
            onChange(next);
          }}
        >
          <option value="">All statuses</option>
          <option>DRAFT</option>
          <option>ACTIVE</option>
          <option>INACTIVE</option>
        </select>
      </label>
      <label>
        Sort
        <select
          value={`${query.sort}:${query.order}`}
          onChange={(event) => {
            const [sort, order] = event.target.value.split(':');
            onChange({
              ...query,
              page: 1,
              sort: sort as NonNullable<ProductQuery['sort']>,
              order: order as NonNullable<ProductQuery['order']>,
            });
          }}
        >
          <option value="createdAt:desc">Newest first</option>
          <option value="name:asc">Name A–Z</option>
          <option value="price:asc">Price low–high</option>
          <option value="price:desc">Price high–low</option>
        </select>
      </label>
    </form>
  );
}
