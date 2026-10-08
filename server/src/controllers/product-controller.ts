import type { RequestHandler } from 'express';
import type { ProductService } from '../services/product-service.js';
import {
  parseCreateProduct,
  parseUpdateProduct,
  parseProductId,
  parseProductQuery,
} from '../validation/products.js';

export class ProductController {
  constructor(
    private readonly service: ProductService,
    private readonly admin = false,
  ) {}
  findAll: RequestHandler = async (req, res) => {
    const query = parseProductQuery(req.query);
    res.json(
      await (this.admin
        ? this.service.findAll(query)
        : this.service.publicList(query)),
    );
  };
  findById: RequestHandler = async (req, res) => {
    res.json({
      data: await (this.admin
        ? this.service.findById(parseProductId(req.params.id))
        : this.service.publicDetail(parseProductId(req.params.id))),
    });
  };
  create: RequestHandler = async (req, res) => {
    const product = await this.service.create(parseCreateProduct(req.body));
    res
      .location(`/api/v1/products/${product.id}`)
      .status(201)
      .json({ data: product });
  };
  update: RequestHandler = async (req, res) => {
    res.json({
      data: await this.service.update(
        parseProductId(req.params.id),
        parseUpdateProduct(req.body),
      ),
    });
  };
  delete: RequestHandler = async (req, res) => {
    await this.service.delete(parseProductId(req.params.id));
    res.status(204).end();
  };
}
