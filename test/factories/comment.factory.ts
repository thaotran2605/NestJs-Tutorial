import { faker } from '@faker-js/faker';
import { DataSource } from 'typeorm';
import { Article } from '../../src/modules/articles/entities/article.entity.js';
import { Comment } from '../../src/modules/comments/entities/comment.entity.js';
import { User } from '../../src/modules/users/entities/user.entity.js';

export interface FakeCommentOverrides {
  body?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export async function createFakeComment(
  dataSource: DataSource,
  article: Article,
  author: User,
  overrides: FakeCommentOverrides = {},
): Promise<Comment> {
  const commentRepository = dataSource.getRepository(Comment);

  const comment = commentRepository.create({
    body: overrides.body ?? faker.lorem.sentence({ min: 4, max: 12 }),
    articleId: article.id,
    authorId: author.id,
    ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    ...(overrides.updatedAt ? { updatedAt: overrides.updatedAt } : {}),
  });

  return commentRepository.save(comment);
}
