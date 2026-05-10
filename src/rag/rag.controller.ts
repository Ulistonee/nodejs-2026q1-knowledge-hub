import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AiRateLimitGuard } from '../ai/guards/ai-rate-limit.guard';
import { RagService } from './rag.service';
import { RagChatDto } from './dto/rag-chat.dto';
import { RagIndexDto } from './dto/rag-index.dto';
import { RagSearchDto } from './dto/rag-search.dto';

@Controller('ai/rag')
@UseGuards(AiRateLimitGuard)
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Delete('index/articles/:articleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteIndexedArticle(
    @Param('articleId', ParseUUIDPipe) articleId: string,
  ): Promise<void> {
    return this.ragService.deleteIndexedArticle(articleId);
  }

  @Get('chat/:conversationId/history')
  getHistory(@Param('conversationId', ParseUUIDPipe) conversationId: string) {
    return this.ragService.getChatHistory(conversationId);
  }

  @Post('index')
  @HttpCode(HttpStatus.OK)
  index(@Body() body: RagIndexDto) {
    return this.ragService.index(body);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  search(@Body() body: RagSearchDto) {
    return this.ragService.search(body);
  }

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  chat(@Body() body: RagChatDto) {
    return this.ragService.chat(body);
  }
}
