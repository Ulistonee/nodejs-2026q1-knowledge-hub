import { Injectable } from '@nestjs/common';

type ArticleAuthorRef = { authorId: string | null | undefined };

@Injectable()
export class ArticleService {
  private readonly articles: ArticleAuthorRef[] = [];

  nullifyAuthor(authorId: string): void {
    for (const article of this.articles) {
      if (article.authorId === authorId) {
        article.authorId = null;
      }
    }
  }
}
