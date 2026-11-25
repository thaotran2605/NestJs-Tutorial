import { randomBytes } from 'node:crypto';
import {
  SLUG_BASE_MAX_LENGTH,
  SLUG_RANDOM_BYTES,
} from '../../modules/articles/articles.constants.js';

export function slugifyText(input: string): string {
  const normalized = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_BASE_MAX_LENGTH)
    .replace(/-+$/g, '');

  return normalized || 'article';
}

export function generateUniqueSlug(title: string): string {
  const baseSlug = slugifyText(title);
  const randomSuffix = randomBytes(SLUG_RANDOM_BYTES).toString('hex');
  return `${baseSlug}-${randomSuffix}`;
}
