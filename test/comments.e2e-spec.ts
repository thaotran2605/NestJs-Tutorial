import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { Article } from '../src/modules/articles/entities/article.entity.js';
import { TokenService } from '../src/modules/auth/token.service.js';
import { COMMENT_BODY_MAX_LENGTH } from '../src/modules/comments/comments.constants.js';
import { Comment } from '../src/modules/comments/entities/comment.entity.js';
import { createFakeArticle } from './factories/article.factory.js';
import { createFakeComment } from './factories/comment.factory.js';
import { createFakeFollow } from './factories/follow.factory.js';
import {
  AuthenticatedFakeUser,
  createAuthenticatedFakeUser,
} from './factories/user.factory.js';
import { createTestApp } from './helpers/app.helper.js';
import { truncateAllTables } from './helpers/database.helper.js';

interface CommentResponseBody {
  id: number;
  createdAt: string;
  updatedAt: string;
  body: string;
  author: {
    username: string;
    bio: string | null;
    image: string | null;
    following: boolean;
  };
}

/**
 * C2-level (Branch & Condition Coverage) E2E test suite for CommentsController.
 *
 * Isolation guarantees:
 * - Runs against the dedicated `conduit_test` database (guarded by `assertTestDatabase`).
 * - Seeds fresh fake data via Faker factories in `beforeEach`.
 * - Truncates all application tables in `afterEach` so every test case is 100% independent.
 */
describe('CommentsController (e2e - C2 coverage)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let tokenService: TokenService;

  let articleAuthor: AuthenticatedFakeUser;
  let commenter: AuthenticatedFakeUser;
  let stranger: AuthenticatedFakeUser;
  let mainArticle: Article;
  let otherArticle: Article;

  beforeAll(async () => {
    const context = await createTestApp();
    app = context.app;
    dataSource = context.dataSource;
    tokenService = app.get(TokenService);

    await truncateAllTables(dataSource);
  });

  beforeEach(async () => {
    articleAuthor = await createAuthenticatedFakeUser(app, dataSource);
    commenter = await createAuthenticatedFakeUser(app, dataSource);
    stranger = await createAuthenticatedFakeUser(app, dataSource);

    mainArticle = await createFakeArticle(dataSource, articleAuthor.user);
    otherArticle = await createFakeArticle(dataSource, articleAuthor.user);
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/articles/:slug/comments (addComment)', () => {
    describe('Authentication branches (JwtAuthGuard)', () => {
      it('should return 401 when Authorization header is missing', async () => {
        await request(app.getHttpServer())
          .post(`/api/articles/${mainArticle.slug}/comments`)
          .send({ comment: { body: faker.lorem.sentence() } })
          .expect(401);
      });

      it('should return 401 when JWT token is malformed or invalid', async () => {
        await request(app.getHttpServer())
          .post(`/api/articles/${mainArticle.slug}/comments`)
          .set('Authorization', 'Token invalid.jwt.token')
          .send({ comment: { body: faker.lorem.sentence() } })
          .expect(401);
      });

      it('should return 401 when JWT token has been revoked in Redis blacklist', async () => {
        await tokenService.revokeToken(commenter.token);

        const res = await request(app.getHttpServer())
          .post(`/api/articles/${mainArticle.slug}/comments`)
          .set('Authorization', `Token ${commenter.token}`)
          .send({ comment: { body: faker.lorem.sentence() } })
          .expect(401);

        expect(res.body.errors.body).toEqual(['Token has been revoked']);
      });

      it('should accept Bearer authorization scheme and return 201', async () => {
        const commentBody = faker.lorem.sentence();

        const res = await request(app.getHttpServer())
          .post(`/api/articles/${mainArticle.slug}/comments`)
          .set('Authorization', `Bearer ${commenter.token}`)
          .send({ comment: { body: commentBody } })
          .expect(201);

        expect(res.body.comment.body).toBe(commentBody);
        expect(res.body.comment.author.username).toBe(commenter.user.username);
      });
    });

    describe('DTO validation branches (CreateCommentDto & ValidationPipe)', () => {
      it('should return 400 when comment envelope is missing', async () => {
        await request(app.getHttpServer())
          .post(`/api/articles/${mainArticle.slug}/comments`)
          .set('Authorization', `Token ${commenter.token}`)
          .send({})
          .expect(400);
      });

      it('should return 400 when comment object is empty', async () => {
        await request(app.getHttpServer())
          .post(`/api/articles/${mainArticle.slug}/comments`)
          .set('Authorization', `Token ${commenter.token}`)
          .send({ comment: {} })
          .expect(400);
      });

      it('should return 400 when payload contains non-whitelisted properties', async () => {
        await request(app.getHttpServer())
          .post(`/api/articles/${mainArticle.slug}/comments`)
          .set('Authorization', `Token ${commenter.token}`)
          .send({
            comment: { body: faker.lorem.sentence(), unexpectedField: 'x' },
          })
          .expect(400);
      });

      it('should return 400 when comment body is an empty string', async () => {
        await request(app.getHttpServer())
          .post(`/api/articles/${mainArticle.slug}/comments`)
          .set('Authorization', `Token ${commenter.token}`)
          .send({ comment: { body: '' } })
          .expect(400);
      });

      it('should return 400 when comment body contains only whitespace', async () => {
        await request(app.getHttpServer())
          .post(`/api/articles/${mainArticle.slug}/comments`)
          .set('Authorization', `Token ${commenter.token}`)
          .send({ comment: { body: '   \t\n  ' } })
          .expect(400);
      });

      it('should return 400 when comment body is not a string', async () => {
        await request(app.getHttpServer())
          .post(`/api/articles/${mainArticle.slug}/comments`)
          .set('Authorization', `Token ${commenter.token}`)
          .send({ comment: { body: 12345 } })
          .expect(400);
      });

      it('should return 400 when comment body exceeds maximum length', async () => {
        const oversizedBody = 'a'.repeat(COMMENT_BODY_MAX_LENGTH + 1);

        await request(app.getHttpServer())
          .post(`/api/articles/${mainArticle.slug}/comments`)
          .set('Authorization', `Token ${commenter.token}`)
          .send({ comment: { body: oversizedBody } })
          .expect(400);
      });

      it('should accept comment body at exact maximum length (boundary)', async () => {
        const boundaryBody = 'a'.repeat(COMMENT_BODY_MAX_LENGTH);

        const res = await request(app.getHttpServer())
          .post(`/api/articles/${mainArticle.slug}/comments`)
          .set('Authorization', `Token ${commenter.token}`)
          .send({ comment: { body: boundaryBody } })
          .expect(201);

        expect(res.body.comment.body).toHaveLength(COMMENT_BODY_MAX_LENGTH);
      });
    });

    describe('Service resource and persistence branches', () => {
      it('should return localized 404 (en & vi) when article slug does not exist', async () => {
        const missingSlug = `missing-${faker.string.alphanumeric(10)}`;

        const resEn = await request(app.getHttpServer())
          .post(`/api/articles/${missingSlug}/comments`)
          .set('Authorization', `Token ${commenter.token}`)
          .send({ comment: { body: faker.lorem.sentence() } })
          .expect(404);
        expect(resEn.body.errors.body).toEqual(['Article not found']);

        const resVi = await request(app.getHttpServer())
          .post(`/api/articles/${missingSlug}/comments?lang=vi`)
          .set('Authorization', `Token ${commenter.token}`)
          .send({ comment: { body: faker.lorem.sentence() } })
          .expect(404);
        expect(resVi.body.errors.body).toEqual(['Không tìm thấy bài viết']);
      });

      it('should trim body, persist comment in DB, set no-store headers, and return RealWorld envelope', async () => {
        const rawText = faker.lorem.sentence();

        const res = await request(app.getHttpServer())
          .post(`/api/articles/${mainArticle.slug}/comments`)
          .set('Authorization', `Token ${commenter.token}`)
          .send({ comment: { body: `   ${rawText}   ` } })
          .expect(201);

        expect(res.headers['cache-control']).toBe(
          'no-store, no-cache, must-revalidate',
        );

        const created = res.body.comment as CommentResponseBody;
        expect(typeof created.id).toBe('number');
        expect(created.body).toBe(rawText);
        expect(created.createdAt).toBeDefined();
        expect(created.updatedAt).toBeDefined();
        expect(created.author).toEqual({
          username: commenter.user.username,
          bio: commenter.user.bio,
          image: commenter.user.image,
          following: false,
        });

        const persisted = await dataSource.getRepository(Comment).findOne({
          where: { id: created.id },
        });
        expect(persisted).not.toBeNull();
        expect(persisted?.body).toBe(rawText);
        expect(persisted?.articleId).toBe(mainArticle.id);
        expect(persisted?.authorId).toBe(commenter.user.id);
      });
    });
  });

  describe('GET /api/articles/:slug/comments (getComments)', () => {
    it('should return localized 404 (en & vi) when article slug does not exist', async () => {
      const missingSlug = `missing-${faker.string.alphanumeric(10)}`;

      const resEn = await request(app.getHttpServer())
        .get(`/api/articles/${missingSlug}/comments`)
        .expect(404);
      expect(resEn.body.errors.body).toEqual(['Article not found']);

      const resVi = await request(app.getHttpServer())
        .get(`/api/articles/${missingSlug}/comments?lang=vi`)
        .expect(404);
      expect(resVi.body.errors.body).toEqual(['Không tìm thấy bài viết']);
    });

    it('should return empty array when article has no comments (comments.length === 0 branch)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/articles/${mainArticle.slug}/comments`)
        .expect(200);

      expect(res.body).toEqual({ comments: [] });
    });

    it('should return comments ordered newest-first with following=false when unauthenticated', async () => {
      const olderTime = new Date('2026-01-01T10:00:00.000Z');
      const newerTime = new Date('2026-01-01T12:00:00.000Z');

      const olderComment = await createFakeComment(
        dataSource,
        mainArticle,
        commenter.user,
        { createdAt: olderTime, updatedAt: olderTime },
      );
      const newerComment = await createFakeComment(
        dataSource,
        mainArticle,
        articleAuthor.user,
        { createdAt: newerTime, updatedAt: newerTime },
      );
      // Seed a comment on another article to verify isolation by articleId
      await createFakeComment(dataSource, otherArticle, stranger.user);

      const res = await request(app.getHttpServer())
        .get(`/api/articles/${mainArticle.slug}/comments`)
        .expect(200);

      const comments = res.body.comments as CommentResponseBody[];
      expect(comments).toHaveLength(2);
      expect(comments[0].id).toBe(newerComment.id);
      expect(comments[1].id).toBe(olderComment.id);
      expect(comments[0].author.following).toBe(false);
      expect(comments[1].author.following).toBe(false);
    });

    it('should return following=false when authenticated user is the sole commenter (otherAuthorIds.length === 0 branch)', async () => {
      const ownComment = await createFakeComment(
        dataSource,
        mainArticle,
        articleAuthor.user,
      );

      const res = await request(app.getHttpServer())
        .get(`/api/articles/${mainArticle.slug}/comments`)
        .set('Authorization', `Token ${articleAuthor.token}`)
        .expect(200);

      const comments = res.body.comments as CommentResponseBody[];
      expect(comments).toHaveLength(1);
      expect(comments[0].id).toBe(ownComment.id);
      expect(comments[0].author.username).toBe(articleAuthor.user.username);
      expect(comments[0].author.following).toBe(false);
    });

    it('should accurately hydrate following status for followed, unfollowed, and self authors when authenticated', async () => {
      await createFakeFollow(dataSource, articleAuthor.user, commenter.user);

      const followedComment = await createFakeComment(
        dataSource,
        mainArticle,
        commenter.user,
      );
      const unfollowedComment = await createFakeComment(
        dataSource,
        mainArticle,
        stranger.user,
      );
      const selfComment = await createFakeComment(
        dataSource,
        mainArticle,
        articleAuthor.user,
      );

      const res = await request(app.getHttpServer())
        .get(`/api/articles/${mainArticle.slug}/comments`)
        .set('Authorization', `Token ${articleAuthor.token}`)
        .expect(200);

      const comments = res.body.comments as CommentResponseBody[];
      expect(comments).toHaveLength(3);

      const byId = new Map(comments.map((item) => [item.id, item]));
      expect(byId.get(followedComment.id)?.author.following).toBe(true);
      expect(byId.get(unfollowedComment.id)?.author.following).toBe(false);
      expect(byId.get(selfComment.id)?.author.following).toBe(false);
    });

    it('should return 401 when an invalid or revoked token is supplied to OptionalJwtAuthGuard', async () => {
      await tokenService.revokeToken(commenter.token);

      await request(app.getHttpServer())
        .get(`/api/articles/${mainArticle.slug}/comments`)
        .set('Authorization', `Token ${commenter.token}`)
        .expect(401);
    });
  });

  describe('DELETE /api/articles/:slug/comments/:id (deleteComment)', () => {
    describe('Authentication and param validation branches', () => {
      it('should return 401 when unauthenticated', async () => {
        const comment = await createFakeComment(
          dataSource,
          mainArticle,
          commenter.user,
        );

        await request(app.getHttpServer())
          .delete(`/api/articles/${mainArticle.slug}/comments/${comment.id}`)
          .expect(401);
      });

      it('should return 401 when token is revoked', async () => {
        const comment = await createFakeComment(
          dataSource,
          mainArticle,
          commenter.user,
        );
        await tokenService.revokeToken(commenter.token);

        await request(app.getHttpServer())
          .delete(`/api/articles/${mainArticle.slug}/comments/${comment.id}`)
          .set('Authorization', `Token ${commenter.token}`)
          .expect(401);
      });

      it('should return 400 when comment id is not a valid integer (ParseIntPipe)', async () => {
        await request(app.getHttpServer())
          .delete(`/api/articles/${mainArticle.slug}/comments/not-an-integer`)
          .set('Authorization', `Token ${commenter.token}`)
          .expect(400);
      });
    });

    describe('Resource lookup branches', () => {
      it('should return localized 404 (en & vi) when article slug does not exist', async () => {
        const missingSlug = `missing-${faker.string.alphanumeric(10)}`;

        const resEn = await request(app.getHttpServer())
          .delete(`/api/articles/${missingSlug}/comments/1`)
          .set('Authorization', `Token ${commenter.token}`)
          .expect(404);
        expect(resEn.body.errors.body).toEqual(['Article not found']);

        const resVi = await request(app.getHttpServer())
          .delete(`/api/articles/${missingSlug}/comments/1?lang=vi`)
          .set('Authorization', `Token ${commenter.token}`)
          .expect(404);
        expect(resVi.body.errors.body).toEqual(['Không tìm thấy bài viết']);
      });

      it('should return localized 404 (en & vi) when comment id does not exist', async () => {
        const resEn = await request(app.getHttpServer())
          .delete(`/api/articles/${mainArticle.slug}/comments/999999`)
          .set('Authorization', `Token ${commenter.token}`)
          .expect(404);
        expect(resEn.body.errors.body).toEqual(['Comment not found']);

        const resVi = await request(app.getHttpServer())
          .delete(`/api/articles/${mainArticle.slug}/comments/999999?lang=vi`)
          .set('Authorization', `Token ${commenter.token}`)
          .expect(404);
        expect(resVi.body.errors.body).toEqual(['Không tìm thấy bình luận']);
      });

      it('should return 404 and keep comment intact when comment belongs to a different article', async () => {
        const commentOnMain = await createFakeComment(
          dataSource,
          mainArticle,
          commenter.user,
        );

        const resVi = await request(app.getHttpServer())
          .delete(
            `/api/articles/${otherArticle.slug}/comments/${commentOnMain.id}?lang=vi`,
          )
          .set('Authorization', `Token ${commenter.token}`)
          .expect(404);
        expect(resVi.body.errors.body).toEqual(['Không tìm thấy bình luận']);

        const stillExists = await dataSource.getRepository(Comment).findOne({
          where: { id: commentOnMain.id },
        });
        expect(stillExists).not.toBeNull();
      });
    });

    describe('Ownership compound condition C2 truth table (!isCommentAuthor && !isArticleAuthor)', () => {
      it('Case 1 (isCommentAuthor=true, isArticleAuthor=false): allows comment author to delete their own comment (204)', async () => {
        const comment = await createFakeComment(
          dataSource,
          mainArticle,
          commenter.user,
        );

        const res = await request(app.getHttpServer())
          .delete(`/api/articles/${mainArticle.slug}/comments/${comment.id}`)
          .set('Authorization', `Token ${commenter.token}`)
          .expect(204);

        expect(res.headers['cache-control']).toBe(
          'no-store, no-cache, must-revalidate',
        );

        const deleted = await dataSource.getRepository(Comment).findOne({
          where: { id: comment.id },
        });
        expect(deleted).toBeNull();
      });

      it('Case 2 (isCommentAuthor=false, isArticleAuthor=true): allows article author to delete another user comment (204)', async () => {
        const comment = await createFakeComment(
          dataSource,
          mainArticle,
          commenter.user,
        );

        await request(app.getHttpServer())
          .delete(`/api/articles/${mainArticle.slug}/comments/${comment.id}`)
          .set('Authorization', `Token ${articleAuthor.token}`)
          .expect(204);

        const deleted = await dataSource.getRepository(Comment).findOne({
          where: { id: comment.id },
        });
        expect(deleted).toBeNull();
      });

      it('Case 3 (isCommentAuthor=true, isArticleAuthor=true): allows article author to delete their own comment on their own article (204)', async () => {
        const ownComment = await createFakeComment(
          dataSource,
          mainArticle,
          articleAuthor.user,
        );

        await request(app.getHttpServer())
          .delete(`/api/articles/${mainArticle.slug}/comments/${ownComment.id}`)
          .set('Authorization', `Token ${articleAuthor.token}`)
          .expect(204);

        const deleted = await dataSource.getRepository(Comment).findOne({
          where: { id: ownComment.id },
        });
        expect(deleted).toBeNull();
      });

      it('Case 4 (isCommentAuthor=false, isArticleAuthor=false): returns localized 403 (en & vi) and preserves comment in DB', async () => {
        const comment = await createFakeComment(
          dataSource,
          mainArticle,
          commenter.user,
        );

        const resEn = await request(app.getHttpServer())
          .delete(`/api/articles/${mainArticle.slug}/comments/${comment.id}`)
          .set('Authorization', `Token ${stranger.token}`)
          .expect(403);
        expect(resEn.body.errors.body).toEqual([
          'You are not authorized to delete this comment',
        ]);

        const resVi = await request(app.getHttpServer())
          .delete(
            `/api/articles/${mainArticle.slug}/comments/${comment.id}?lang=vi`,
          )
          .set('Authorization', `Token ${stranger.token}`)
          .expect(403);
        expect(resVi.body.errors.body).toEqual([
          'Bạn không có quyền xóa bình luận này',
        ]);

        const preserved = await dataSource.getRepository(Comment).findOne({
          where: { id: comment.id },
        });
        expect(preserved).not.toBeNull();
      });
    });
  });
});
