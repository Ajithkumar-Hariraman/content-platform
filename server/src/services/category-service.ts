import type { CategoryRepository } from '../repositories/category-repository.js';
export class CategoryService {
  constructor(
    private readonly categories: Pick<CategoryRepository, 'findAll'>,
  ) {}
  async findAll() {
    return await this.categories.findAll();
  }
}
