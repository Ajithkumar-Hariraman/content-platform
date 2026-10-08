import type { RequestHandler } from 'express';
import type { CategoryService } from '../services/category-service.js';
export class CategoryController {
  constructor(private readonly service: CategoryService) {}
  findAll: RequestHandler = async (_req, res) => {
    res.json({ data: await this.service.findAll() });
  };
}
