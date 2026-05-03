import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ArticleModule } from './article/article.module';
import { CategoryModule } from './category/category.module';
import { CommentModule } from './comment/comment.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AppLogger } from './common/logger';
import { LoggingMiddleware } from './common/middleware/logging.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    JwtModule.register({}),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
    }),
    PrismaModule,
    UserModule,
    CategoryModule,
    ArticleModule,
    CommentModule,
    AuthModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AppLogger,
    LoggingMiddleware,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [AppLogger],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(LoggingMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
