import { I18nContext, I18nService } from 'nestjs-i18n';

export function translateWithContext(
  i18n: I18nService,
  key: string,
  args?: Record<string, unknown>,
): string {
  const lang = I18nContext.current()?.lang ?? 'en';
  return i18n.t(key, { lang, args });
}
