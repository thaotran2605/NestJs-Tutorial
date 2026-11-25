import { generateUniqueSlug, slugifyText } from './slug.util.js';

describe('slug.util', () => {
  describe('slugifyText', () => {
    it('should normalize Vietnamese characters and diacritics cleanly', () => {
      expect(slugifyText('Hướng dẫn NestJS & MySQL 8')).toBe(
        'huong-dan-nestjs-mysql-8',
      );
      expect(slugifyText('Đập tan lỗi N+1 query')).toBe(
        'dap-tan-loi-n-1-query',
      );
    });

    it('should fallback to article when input contains only symbols', () => {
      expect(slugifyText('!!! ??? ###')).toBe('article');
    });
  });

  describe('generateUniqueSlug', () => {
    it('should append a 6-char hex suffix to ensure uniqueness', () => {
      const slug1 = generateUniqueSlug('How to train your dragon');
      const slug2 = generateUniqueSlug('How to train your dragon');

      expect(slug1).toMatch(/^how-to-train-your-dragon-[0-9a-f]{6}$/);
      expect(slug2).toMatch(/^how-to-train-your-dragon-[0-9a-f]{6}$/);
      expect(slug1).not.toBe(slug2);
    });
  });
});
