import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ArticleModule } from './article/article.module';
import { CategoryModule } from './category/category.module';
import { CommentModule } from './comment/comment.module';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { LoggingMiddleware } from './common/middleware/logging.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    UserModule,
    CategoryModule,
    ArticleModule,
    CommentModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    LoggingMiddleware,
    { provide: APP_GUARD, useClass: ApiKeyGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(LoggingMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
