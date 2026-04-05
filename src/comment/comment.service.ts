import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ArticleService } from '../article/article.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Comment } from './interfaces/comment';

@Injectable()
export class CommentService {
  private comments: Comment[] = [];

  constructor(
    @Inject(forwardRef(() => ArticleService))
    private readonly articlesService: ArticleService,
  ) {}

  removeByAuthor(authorId: string): void {
    this.comments = this.comments.filter((c) => c.authorId !== authorId);
  }

  removeByArticle(articleId: string): void {
    this.comments = this.comments.filter((c) => c.articleId !== articleId);
  }

  findByArticleId(articleId: string): Comment[] {
    return this.comments.filter((c) => c.articleId === articleId);
  }

  findOne(id: string): Comment {
    const comment = this.comments.find((c) => c.id === id);
    if (!comment) {
      throw new NotFoundException();
    }
    return comment;
  }

  create(dto: CreateCommentDto): Comment {
    if (!this.articlesService.hasArticle(dto.articleId)) {
      throw new UnprocessableEntityException();
    }
    const comment: Comment = {
      id: randomUUID(),
      content: dto.content,
      articleId: dto.articleId,
      authorId: dto.authorId ?? null,
      createdAt: Date.now(),
    };
    this.comments.push(comment);
    return comment;
  }

  remove(id: string): void {
    const idx = this.comments.findIndex((c) => c.id === id);
    if (idx === -1) {
      throw new NotFoundException();
    }
    this.comments.splice(idx, 1);
  }
}
