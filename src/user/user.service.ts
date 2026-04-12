import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListQueryDto } from '../common/dto/list-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { applyListQuery } from '../common/utils/apply-list-query';
import { UserRole as PrismaUserRole } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

  private toUser(row: {
    id: string;
    login: string;
    password: string;
    role: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return {
      id: row.id,
      login: row.login,
      password: row.password,
      role: row.role as UserRole,
      version: row.version,
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
    };
  }

  private toPublic(user: User): PublicUser {
    const { password, ...rest } = user;
    void password;
    return rest;
  }

  async findAll(
    query: ListQueryDto,
  ): Promise<PublicUser[] | PaginatedResult<PublicUser>> {
    const rows = await this.prisma.user.findMany();
    const items = rows.map((r) => this.toPublic(this.toUser(r)));
    return applyListQuery(items, query, USER_SORT_FIELDS);
  }

  async findOne(id: string): Promise<PublicUser> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException();
    }
    return this.toPublic(this.toUser(row));
  }

  async create(userDto: CreateUserDto): Promise<PublicUser> {
    const row = await this.prisma.user.create({
      data: {
        login: userDto.login,
        password: userDto.password,
        role: (userDto.role ?? UserRole.VIEWER) as unknown as PrismaUserRole,
      },
    });
    return this.toPublic(this.toUser(row));
  }

  async updatePassword(
    id: string,
    dto: UpdatePasswordDto,
  ): Promise<PublicUser> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException();
    }
    if (row.password !== dto.oldPassword) {
      throw new ForbiddenException();
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        password: dto.newPassword,
        version: { increment: 1 },
      },
    });
    return this.toPublic(this.toUser(updated));
  }

  async remove(id: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException();
    }
    await this.prisma.$transaction([
      this.prisma.article.updateMany({
        where: { authorId: id },
        data: { authorId: null },
      }),
      this.prisma.comment.deleteMany({ where: { authorId: id } }),
      this.prisma.user.delete({ where: { id } }),
    ]);
  }
}
