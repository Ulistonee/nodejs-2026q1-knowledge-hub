import { Module } from '@nestjs/common';
import { ArticleModule } from '../article/article.module';
import { CommentModule } from '../comment/comment.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [ArticleModule, CommentModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}