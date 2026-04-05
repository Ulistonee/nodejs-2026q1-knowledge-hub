import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CommentService } from '../comment/comment.service';
import { ArticleListQueryDto } from '../common/dto/article-list-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { applyListQuery } from '../common/utils/apply-list-query';
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

@Injectable()
export class ArticleService {
  private readonly articles: Article[] = [];

  constructor(
    @Inject(forwardRef(() => CommentService))
    private readonly commentsService: CommentService,
  ) {}

  nullifyAuthor(authorId: string): void {
    for (const article of this.articles) {
      if (article.authorId === authorId) {
        article.authorId = null;
      }
    }
  }

  nullifyCategory(categoryId: string): void {
    for (const article of this.articles) {
      if (article.categoryId === categoryId) {
        article.categoryId = null;
      }
    }
  }

  findAll(dto: ArticleListQueryDto): Article[] | PaginatedResult<Article> {
    let list = this.articles;
    if (dto.status) {
      list = list.filter((a) => a.status === dto.status);
    }
    if (dto.categoryId) {
      list = list.filter((a) => a.categoryId === dto.categoryId);
    }
    if (dto.tag) {
      list = list.filter((a) => a.tags.includes(dto.tag));
    }
    return applyListQuery(list, dto, ARTICLE_SORT_FIELDS);
  }

  hasArticle(id: string): boolean {
    return this.articles.some((a) => a.id === id);
  }

  findOne(id: string): Article {
    const article = this.articles.find((a) => a.id === id);
    if (!article) {
      throw new NotFoundException();
    }
    return article;
  }

  create(dto: CreateArticleDto): Article {
    const now = Date.now();
    const article: Article = {
      id: randomUUID(),
      title: dto.title,
      content: dto.content,
      status: dto.status ?? ArticleStatus.DRAFT,
      authorId: dto.authorId ?? null,
      categoryId: dto.categoryId ?? null,
      tags: dto.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };
    this.articles.push(article);
    return article;
  }

  update(id: string, dto: UpdateArticleDto): Article {
    const article = this.articles.find((a) => a.id === id);
    if (!article) {
      throw new NotFoundException();
    }
    if (dto.title !== undefined) {
      article.title = dto.title;
    }
    if (dto.content !== undefined) {
      article.content = dto.content;
    }
    if (dto.status !== undefined) {
      article.status = dto.status;
    }
    if (dto.authorId !== undefined) {
      article.authorId = dto.authorId;
    }
    if (dto.categoryId !== undefined) {
      article.categoryId = dto.categoryId;
    }
    if (dto.tags !== undefined) {
      article.tags = dto.tags;
    }
    article.updatedAt = Date.now();

    return article;
  }

  remove(id: string): void {
    const idx = this.articles.findIndex((article) => article.id === id);
    if (idx === -1) {
      throw new NotFoundException();
    }
    this.commentsService.removeByArticle(id);
    this.articles.splice(idx, 1);
  }
}
