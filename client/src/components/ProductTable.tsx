import { Link } from 'react-router-dom';
import type { PaginatedResult, Product } from '../types';
interface Props {
  result: PaginatedResult<Product>;
  administration: boolean;
  canWrite: boolean;
  canDelete: boolean;
  actionsDisabled: boolean;
  deletingId: string | null;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onPage: (page: number) => void;
}
export function ProductTable({
  result,
  administration,
  canWrite,
  canDelete,
  actionsDisabled,
  deletingId,
  onEdit,
  onDelete,
  onPage,
}: Props) {
  return (
    <>
      {result.data.length === 0 ? (
        <p>No products match these filters.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Category</th>
                <th scope="col">Price</th>
                <th scope="col">Status</th>
                {administration && <th scope="col">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {result.data.map((product) => (
                <tr key={product.id}>
                  <td>
                    <Link to={`/products/${product.id}`}>{product.name}</Link>
                  </td>
                  <td>{product.category.name}</td>
                  <td className="price">{product.price}</td>
                  <td>
                    <span className="status">{product.status}</span>
                  </td>
                  {administration && (
                    <td>
                      <div className="actions">
                        <button
                          className="secondary"
                          disabled={actionsDisabled || !canWrite}
                          onClick={() => onEdit(product)}
                        >
                          Edit
                        </button>
                        <button
                          className="danger"
                          disabled={actionsDisabled || !canDelete}
                          onClick={() => {
                            onDelete(product);
                          }}
                        >
                          {deletingId === product.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="pagination">
        <button
          className="secondary"
          disabled={result.pagination.page <= 1}
          onClick={() => onPage(result.pagination.page - 1)}
        >
          Previous
        </button>
        <span>
          Page {result.pagination.page} of{' '}
          {Math.max(1, result.pagination.totalPages)} ·{' '}
          {result.pagination.total} products
        </span>
        <button
          className="secondary"
          disabled={result.pagination.page >= result.pagination.totalPages}
          onClick={() => onPage(result.pagination.page + 1)}
        >
          Next
        </button>
      </div>
    </>
  );
}
