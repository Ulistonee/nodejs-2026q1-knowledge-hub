import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ArticleService } from '../article/article.service';
import { ListQueryDto } from '../common/dto/list-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { applyListQuery } from '../common/utils/apply-list-query';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './interfaces/category';

const CATEGORY_SORT_FIELDS: (keyof Category)[] = ['id', 'name', 'description'];

@Injectable()
export class CategoryService {
  private categories: Category[] = [];

  constructor(private readonly articlesService: ArticleService) {}

  findAll(query: ListQueryDto): Category[] | PaginatedResult<Category> {
    return applyListQuery(this.categories, query, CATEGORY_SORT_FIELDS);
  }

  findOne(id: string): Category {
    const category = this.categories.find((c) => c.id === id);
    if (!category) {
      throw new NotFoundException();
    }
    return category;
  }

  create(dto: CreateCategoryDto): Category {
    const category: Category = {
      id: randomUUID(),
      name: dto.name,
      description: dto.description,
    };
    this.categories.push(category);
    return category;
  }

  update(id: string, dto: UpdateCategoryDto): Category {
    const category = this.categories.find((c) => c.id === id);
    if (!category) {
      throw new NotFoundException();
    }
    if (dto.name !== undefined) {
      category.name = dto.name;
    }
    if (dto.description !== undefined) {
      category.description = dto.description;
    }
    return category;
  }

  remove(id: string): void {
    const idx = this.categories.findIndex((c) => c.id === id);
    if (idx === -1) {
      throw new NotFoundException();
    }
    this.articlesService.nullifyCategory(id);
    this.categories.splice(idx, 1);
  }
}
