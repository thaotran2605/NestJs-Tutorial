import { trimString, trimStringArray } from './transform.util.js';

describe('transform.util', () => {
  describe('trimString', () => {
    it('should trim leading and trailing whitespace on strings', () => {
      expect(trimString({ value: '  hello world  ' })).toBe('hello world');
      expect(trimString({ value: '   ' })).toBe('');
    });

    it('should return non-string values unchanged', () => {
      expect(trimString({ value: null })).toBeNull();
      expect(trimString({ value: undefined })).toBeUndefined();
      expect(trimString({ value: 123 })).toBe(123);
    });
  });

  describe('trimStringArray', () => {
    it('should trim each string element in an array', () => {
      expect(trimStringArray({ value: [' nestjs ', ' typeorm '] })).toEqual([
        'nestjs',
        'typeorm',
      ]);
    });

    it('should return non-array values unchanged', () => {
      expect(trimStringArray({ value: 'not-an-array' })).toBe('not-an-array');
      expect(trimStringArray({ value: undefined })).toBeUndefined();
    });
  });
});
