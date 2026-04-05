import { Injectable } from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Comment } from './interfaces/comment';
import { randomUUID } from 'crypto';

@Injectable()
export class CommentService {
  private comments: Comment[] = [];

  removeByAuthor(authorId: string): void {
    this.comments = this.comments.filter((c) => c.authorId !== authorId);
  }

  removeByArticle(articleId: string): void {
    this.comments = this.comments.filter((c) => c.articleId !== articleId);
  }

  findByArticleId(articleId: string): Comment[] {
    return this.comments.filter((c) => c.articleId === articleId);
  }

  create(dto: CreateCommentDto): Comment {
    const comment: Comment = {
      id: randomUUID(),
      content: dto.content,
      articleId: dto.articleId,
      authorId: dto.authorId,
      createdAt: Date.now(),
    };
    this.comments.push(comment);
    return comment;
  }

  remove(id: string): void {
    this.comments = this.comments.filter((c) => c.id !== id);
  }
}
