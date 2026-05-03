import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { AiService } from './ai.service';
import { AnalyzeArticleDto } from './dto/analyze-article.dto';
import { GenerateAiDto } from './dto/generate-ai.dto';
import { SummarizeArticleDto } from './dto/summarize-article.dto';
import { TranslateArticleDto } from './dto/translate-article.dto';
import { AiRateLimitGuard } from './guards/ai-rate-limit.guard';

@Controller('ai')
@UseGuards(AiRateLimitGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /** Totals, per-endpoint counts, token sums, Gemini latency, summarize/translate cache hit ratio. Admin only. */
  @Get('usage')
  @Roles('admin')
  getUsage() {
    return this.aiService.getDiagnostics();
  }

  @Post('articles/:articleId/summarize')
  @HttpCode(HttpStatus.OK)
  summarizeArticle(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Body() body: SummarizeArticleDto,
  ) {
    return this.aiService.summarizeArticle(articleId, body);
  }

  @Post('articles/:articleId/translate')
  @HttpCode(HttpStatus.OK)
  translateArticle(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Body() body: TranslateArticleDto,
  ) {
    return this.aiService.translateArticle(articleId, body);
  }

  @Post('articles/:articleId/analyze')
  @HttpCode(HttpStatus.OK)
  analyzeArticle(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Body() body: AnalyzeArticleDto,
  ) {
    return this.aiService.analyzeArticle(articleId, body);
  }

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  generate(@Body() body: GenerateAiDto) {
    return this.aiService.generateFreeform(body);
  }
}
