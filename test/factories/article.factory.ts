import { faker } from '@faker-js/faker';
import { DataSource } from 'typeorm';
import { Article } from '../../src/modules/articles/entities/article.entity.js';
import { User } from '../../src/modules/users/entities/user.entity.js';

export interface FakeArticleOverrides {
  title?: string;
  slug?: string;
  description?: string;
  body?: string;
}

export async function createFakeArticle(
  dataSource: DataSource,
  author: User,
  overrides: FakeArticleOverrides = {},
): Promise<Article> {
  const articleRepository = dataSource.getRepository(Article);
  const title = overrides.title ?? faker.lorem.sentence({ min: 3, max: 6 });
  const uniqueSuffix = faker.string.alphanumeric({
    length: 8,
    casing: 'lower',
  });
  const slug =
    overrides.slug ??
    `${faker.helpers.slugify(title).toLowerCase().slice(0, 60)}-${uniqueSuffix}`;

  const article = articleRepository.create({
    title,
    slug,
    description: overrides.description ?? faker.lorem.sentence(),
    body: overrides.body ?? faker.lorem.paragraphs(2),
    authorId: author.id,
  });

  return articleRepository.save(article);
}
