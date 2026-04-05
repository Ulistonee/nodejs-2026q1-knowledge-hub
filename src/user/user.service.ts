import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ArticleService } from '../article/article.service';
import { CommentService } from '../comment/comment.service';
import { ListQueryDto } from '../common/dto/list-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { applyListQuery } from '../common/utils/apply-list-query';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UserRole } from './enums/user-role.enum';
import { PublicUser, User } from './interfaces/user';

const USER_SORT_FIELDS: (keyof PublicUser)[] = [
  'id',
  'login',
  'role',
  'createdAt',
  'updatedAt',
  'version',
];

@Injectable()
export class UserService {
  private users: User[] = [];

  constructor(
    private readonly articlesService: ArticleService,
    private readonly commentsService: CommentService,
  ) {}

  private toPublic(user: User): PublicUser {
    const { password, ...rest } = user;
    void password;
    return rest;
  }

  findAll(query: ListQueryDto): PublicUser[] | PaginatedResult<PublicUser> {
    const items = this.users.map((u) => this.toPublic(u));
    return applyListQuery(items, query, USER_SORT_FIELDS);
  }

  findOne(id: string): PublicUser {
    const user = this.users.find((u) => u.id === id);
    if (!user) {
      throw new NotFoundException();
    }
    return this.toPublic(user);
  }

  create(userDto: CreateUserDto): PublicUser {
    const now = Date.now();
    const user: User = {
      id: randomUUID(),
      login: userDto.login,
      password: userDto.password,
      role: userDto.role ?? UserRole.VIEWER,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    this.users.push(user);
    return this.toPublic(user);
  }

  updatePassword(id: string, dto: UpdatePasswordDto): PublicUser {
    const user = this.users.find((u) => u.id === id);
    if (!user) {
      throw new NotFoundException();
    }
    if (user.password !== dto.oldPassword) {
      throw new ForbiddenException();
    }
    user.password = dto.newPassword;
    const now = Date.now();
    user.updatedAt = now > user.createdAt ? now : user.createdAt + 1;
    user.version += 1;
    return this.toPublic(user);
  }

  remove(id: string): void {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx === -1) {
      throw new NotFoundException();
    }
    this.articlesService.nullifyAuthor(id);
    this.commentsService.removeByAuthor(id);
    this.users.splice(idx, 1);
  }
}
