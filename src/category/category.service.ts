import { Injectable } from '@nestjs/common';
import { ListQueryDto } from '../common/dto/list-query.dto';
import { NotFoundError } from '../common/errors/app-errors';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { applyListQuery } from '../common/utils/apply-list-query';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './interfaces/category';

const CATEGORY_SORT_FIELDS: (keyof Category)[] = ['id', 'name', 'description'];

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: ListQueryDto,
  ): Promise<Category[] | PaginatedResult<Category>> {
    const rows = await this.prisma.category.findMany();
    return applyListQuery(rows, query, CATEGORY_SORT_FIELDS);
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundError(`Category not found`);
    }
    return category;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    return this.prisma.category.create({
      data: {
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError(`Category not found`);
    }
    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
      },
    });
  }

  async remove(id: string): Promise<void> {
    const result = await this.prisma.category.deleteMany({ where: { id } });
    if (result.count === 0) {
      throw new NotFoundError(`Category not found`);
    }
  }
}
