import { Module, forwardRef } from '@nestjs/common';
import { RagModule } from '../rag/rag.module';
import { ArticleController } from './article.controller';
import { ArticleService } from './article.service';

@Module({
  imports: [forwardRef(() => RagModule)],
  controllers: [ArticleController],
  providers: [ArticleService],
  exports: [ArticleService],
})
export class ArticleModule {}
