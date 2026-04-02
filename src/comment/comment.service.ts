import { Injectable } from '@nestjs/common';

type CommentAuthorRef = { authorId?: string | null };

@Injectable()
export class CommentService {
  private comments: CommentAuthorRef[] = [];

  removeByAuthor(authorId: string): void {
    this.comments = this.comments.filter((c) => c.authorId !== authorId);
  }
}
