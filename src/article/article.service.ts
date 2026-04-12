import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ArticleStatus as PrismaArticleStatus,
  Prisma,
} from '../../generated/prisma';
import { ArticleListQueryDto } from '../common/dto/article-list-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ArticleStatus } from './enums/article-status.enum';
import { Article } from './interfaces/article';

const ARTICLE_SORT_FIELDS: (keyof Article)[] = [
  'id',
  'title',
  'content',
  'status',
  'authorId',
  'categoryId',
  'createdAt',
  'updatedAt',
];

type ArticleWithTags = Prisma.ArticleGetPayload<{
  include: { tags: true };
}>;

@Injectable()
export class ArticleService {
  constructor(private readonly prisma: PrismaService) {}

  private mapArticle(row: ArticleWithTags): Article {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      status: row.status as ArticleStatus,
      authorId: row.authorId,
      categoryId: row.categoryId,
      tags: row.tags.map((t) => t.name),
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
    };
  }

  private buildOrderBy(
    dto: ArticleListQueryDto,
  ): Prisma.ArticleOrderByWithRelationInput | undefined {
    if (dto.sortBy === undefined || dto.sortBy === '') {
      return undefined;
    }
    const key = dto.sortBy as keyof Article;
    if (!ARTICLE_SORT_FIELDS.includes(key)) {
      throw new BadRequestException(`Invalid sortBy: ${dto.sortBy}`);
    }
    const order = dto.order === 'desc' ? 'desc' : 'asc';
    return { [dto.sortBy]: order } as Prisma.ArticleOrderByWithRelationInput;
  }

  private buildWhere(dto: ArticleListQueryDto): Prisma.ArticleWhereInput {
    const where: Prisma.ArticleWhereInput = {};
    if (dto.status) {
      where.status = dto.status as PrismaArticleStatus;
    }
    if (dto.categoryId) {
      where.categoryId = dto.categoryId;
    }
    if (dto.tag) {
      where.tags = { some: { name: dto.tag } };
    }
    return where;
  }

  async findAll(
    dto: ArticleListQueryDto,
  ): Promise<Article[] | PaginatedResult<Article>> {
    const where = this.buildWhere(dto);
    const orderBy = this.buildOrderBy(dto);
    const wantsPagination = dto.page !== undefined || dto.limit !== undefined;

    if (!wantsPagination) {
      const rows = await this.prisma.article.findMany({
        where,
        ...(orderBy ? { orderBy } : {}),
        include: { tags: true },
      });
      return rows.map((r) => this.mapArticle(r));
    }

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;
    const [total, rows] = await Promise.all([
      this.prisma.article.count({ where }),
      this.prisma.article.findMany({
        where,
        ...(orderBy ? { orderBy } : {}),
        skip: (page - 1) * limit,
        take: limit,
        include: { tags: true },
      }),
    ]);

    return {
      total,
      page,
      limit,
      data: rows.map((r) => this.mapArticle(r)),
    };
  }

  async findOne(id: string): Promise<Article> {
    const row = await this.prisma.article.findUnique({
      where: { id },
      include: { tags: true },
    });
    if (!row) {
      throw new NotFoundException();
    }
    return this.mapArticle(row);
  }

  async create(dto: CreateArticleDto): Promise<Article> {
    const tagNames = dto.tags ?? [];
    const row = await this.prisma.article.create({
      data: {
        title: dto.title,
        content: dto.content,
        status: dto.status
          ? (dto.status as unknown as PrismaArticleStatus)
          : PrismaArticleStatus.DRAFT,
        authorId: dto.authorId ?? null,
        categoryId: dto.categoryId ?? null,
        tags: {
          connectOrCreate: tagNames.map((name) => ({
            where: { name },
            create: { name },
          })),
        },
      },
      include: { tags: true },
    });
    return this.mapArticle(row);
  }

  async update(id: string, dto: UpdateArticleDto): Promise<Article> {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException();
    }

    const data: Prisma.ArticleUncheckedUpdateInput = {};
    if (dto.title !== undefined) {
      data.title = dto.title;
    }
    if (dto.content !== undefined) {
      data.content = dto.content;
    }
    if (dto.status !== undefined) {
      data.status = dto.status as unknown as PrismaArticleStatus;
    }
    if (dto.authorId !== undefined) {
      data.authorId = dto.authorId;
    }
    if (dto.categoryId !== undefined) {
      data.categoryId = dto.categoryId;
    }
    if (dto.tags !== undefined) {
      const upserted = await Promise.all(
        dto.tags.map((name) =>
          this.prisma.tag.upsert({
            where: { name },
            create: { name },
            update: {},
          }),
        ),
      );
      data.tags = {
        set: upserted.map((t) => ({ id: t.id })),
      };
    }

    const row = await this.prisma.article.update({
      where: { id },
      data,
      include: { tags: true },
    });
    return this.mapArticle(row);
  }

  async remove(id: string): Promise<void> {
    const result = await this.prisma.article.deleteMany({ where: { id } });
    if (result.count === 0) {
      throw new NotFoundException();
    }
  }
}
