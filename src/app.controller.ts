import { Controller, Get } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { I18nLang } from 'nestjs-i18n';
import { AppService } from './app.service.js';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Get root welcome message' })
  @ApiQuery({ name: 'lang', required: false, description: 'Language code (e.g. en, vi)' })
  @ApiHeader({ name: 'accept-language', required: false, description: 'Language preference header' })
  @ApiResponse({ status: 200, description: 'Localized welcome message' })
  async getHello(@I18nLang() lang: string): Promise<{ message: string }> {
    const message = await this.appService.getHello(lang);
    return { message };
  }

  @Get('health')
  @ApiOperation({ summary: 'API Health check' })
  @ApiQuery({ name: 'lang', required: false, description: 'Language code (e.g. en, vi)' })
  @ApiResponse({ status: 200, description: 'Health status and timestamp' })
  async getHealth(@I18nLang() lang: string) {
    return this.appService.getHealth(lang);
  }
}
