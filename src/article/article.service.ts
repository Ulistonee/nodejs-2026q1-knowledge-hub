import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ArticleStatus } from './enums/article-status.enum';
import { Article } from './interfaces/article';

@Injectable()
export class ArticleService {
  private readonly articles: Article[] = [];

  nullifyAuthor(authorId: string): void {
    for (const article of this.articles) {
      if (article.authorId === authorId) {
        article.authorId = null;
      }
    }
  }

  findAll(): Article[] {
    return this.articles;
  }

  findOne(id: string): Article {
    return this.articles.find((article) => article.id === id);
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
    console.log('update id:', id);
    console.log('update dto:', JSON.stringify(dto));
    const article = this.articles.find((a) => a.id === id);
    console.log('found article:', article ? article.id : 'NOT FOUND');
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
    console.log('after update:', JSON.stringify(article));

    return article;
  }

  remove(id: string): void {
    const idx = this.articles.findIndex((article) => article.id === id);
    if (idx === -1) {
      throw new NotFoundException();
    }
    this.articles.splice(idx, 1);
  }
}
