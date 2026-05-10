import { Module, forwardRef } from '@nestjs/common';
import { ArticleModule } from '../article/article.module';
import { AiConversationService } from './ai-conversation.service';
import { AiCacheService } from './ai-cache.service';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiUsageService } from './ai-usage.service';
import { GeminiService } from './gemini.service';
import { AiRateLimitGuard } from './guards/ai-rate-limit.guard';

@Module({
  imports: [forwardRef(() => ArticleModule)],
  controllers: [AiController],
  providers: [
    AiService,
    GeminiService,
    AiCacheService,
    AiUsageService,
    AiConversationService,
    AiRateLimitGuard,
  ],
  exports: [AiService, GeminiService, AiUsageService, AiRateLimitGuard],
})
export class AiModule {}
