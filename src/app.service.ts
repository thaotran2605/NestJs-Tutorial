import { Injectable } from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';

@Injectable()
export class AppService {
  constructor(private readonly i18n: I18nService) {}

  async getHello(lang?: string): Promise<string> {
    const currentLang = lang || I18nContext.current()?.lang || 'en';
    return this.i18n.t('common.HELLO', { lang: currentLang });
  }

  async getHealth(lang?: string): Promise<{ status: string; message: string; timestamp: string }> {
    const currentLang = lang || I18nContext.current()?.lang || 'en';
    const message = await this.i18n.t('common.HEALTH_OK', { lang: currentLang });
    return {
      status: 'ok',
      message,
      timestamp: new Date().toISOString(),
    };
  }
}
