import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CategoryModule } from './category/category.module';
import { CommentModule } from './comment/comment.module';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { LoggingMiddleware } from './common/middleware/logging.middleware';
import { UserModule } from './user/user.module';

@Module({
  imports: [UserModule, CategoryModule, CommentModule],
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
