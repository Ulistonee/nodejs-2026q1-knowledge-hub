import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getRoot() {
    return { status: 'ok' };
  }

  @Public()
  @Get('health')
  getHealth(): { status: string } {
    return this.appService.getHealth();
  }
}
