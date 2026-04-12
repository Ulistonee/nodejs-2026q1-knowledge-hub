import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CommentListQueryDto } from '../common/dto/comment-list-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { applyListQuery } from '../common/utils/apply-list-query';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Comment } from './interfaces/comment';

const COMMENT_SORT_FIELDS: (keyof Comment)[] = [
  'id',
  'content',
  'articleId',
  'authorId',
  'createdAt',
];

@Injectable()
export class CommentService {
  constructor(private readonly prisma: PrismaService) {}

  private mapComment(row: {
    id: string;
    content: string;
    articleId: string;
    authorId: string | null;
    createdAt: Date;
  }): Comment {
    return {
      id: row.id,
      content: row.content,
      articleId: row.articleId,
      authorId: row.authorId,
      createdAt: row.createdAt.getTime(),
    };
  }

  async findByArticleId(
    articleId: string,
    query: CommentListQueryDto,
  ): Promise<Comment[] | PaginatedResult<Comment>> {
    const rows = await this.prisma.comment.findMany({
      where: { articleId },
    });
    const list = rows.map((r) => this.mapComment(r));
    return applyListQuery(list, query, COMMENT_SORT_FIELDS);
  }

  async findOne(id: string): Promise<Comment> {
    const row = await this.prisma.comment.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException();
    }
    return this.mapComment(row);
  }

  async create(dto: CreateCommentDto): Promise<Comment> {
    const article = await this.prisma.article.findUnique({
      where: { id: dto.articleId },
    });
    if (!article) {
      throw new UnprocessableEntityException();
    }
    const row = await this.prisma.comment.create({
      data: {
        content: dto.content,
        articleId: dto.articleId,
        authorId: dto.authorId ?? null,
      },
    });
    return this.mapComment(row);
  }

  async remove(id: string): Promise<void> {
    const result = await this.prisma.comment.deleteMany({ where: { id } });
    if (result.count === 0) {
      throw new NotFoundException();
    }
  }
}
