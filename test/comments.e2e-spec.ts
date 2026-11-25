import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource, In } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { User } from '../src/modules/users/entities/user.entity.js';

describe('Comments API (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const uniqueSuffix = Date.now().toString();

  const articleAuthor = {
    username: `c_author_${uniqueSuffix}`,
    email: `c_author_${uniqueSuffix}@example.com`,
    password: 'Password123!',
  };

  const commenterUser = {
    username: `c_commenter_${uniqueSuffix}`,
    email: `c_commenter_${uniqueSuffix}@example.com`,
    password: 'Password123!',
  };

  const strangerUser = {
    username: `c_stranger_${uniqueSuffix}`,
    email: `c_stranger_${uniqueSuffix}@example.com`,
    password: 'Password123!',
  };

  let authorToken: string;
  let commenterToken: string;
  let strangerToken: string;
  let mainArticleSlug: string;
  let otherArticleSlug: string;

  const createCommentViaApi = async (
    slug: string,
    token: string,
    body: string,
  ) => {
    const res = await request(app.getHttpServer())
      .post(`/api/articles/${slug}/comments`)
      .set('Authorization', `Token ${token}`)
      .send({ comment: { body } })
      .expect(201);
    return res.body.comment;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    const configService = app.get(ConfigService);
    expect(configService.get('DB_DATABASE')).toBe('conduit_test');

    dataSource = app.get(DataSource);

    const [resAuthor, resCommenter, resStranger] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/users')
        .send({ user: articleAuthor })
        .expect(201),
      request(app.getHttpServer())
        .post('/api/users')
        .send({ user: commenterUser })
        .expect(201),
      request(app.getHttpServer())
        .post('/api/users')
        .send({ user: strangerUser })
        .expect(201),
    ]);

    authorToken = resAuthor.body.user.token;
    commenterToken = resCommenter.body.user.token;
    strangerToken = resStranger.body.user.token;

    const mainArticleRes = await request(app.getHttpServer())
      .post('/api/articles')
      .set('Authorization', `Token ${authorToken}`)
      .send({
        article: {
          title: `Article For Comments ${uniqueSuffix}`,
          description: 'Comments test description',
          body: 'Comments test body',
        },
      })
      .expect(201);
    mainArticleSlug = mainArticleRes.body.article.slug;

    const otherArticleRes = await request(app.getHttpServer())
      .post('/api/articles')
      .set('Authorization', `Token ${authorToken}`)
      .send({
        article: {
          title: `Other Article ${uniqueSuffix}`,
          description: 'Other article desc',
          body: 'Other article body',
        },
      })
      .expect(201);
    otherArticleSlug = otherArticleRes.body.article.slug;
  });

  afterAll(async () => {
    // Deleting test users cascades cleanly to articles, comments, and follows
    await dataSource.getRepository(User).delete({
      email: In([
        articleAuthor.email,
        commenterUser.email,
        strangerUser.email,
      ]),
    });
    await app.close();
  });

  describe('POST /api/articles/:slug/comments (Add Comment)', () => {
    it('should return 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .post(`/api/articles/${mainArticleSlug}/comments`)
        .send({ comment: { body: 'Unauthorized comment' } })
        .expect(401);
    });

    it('should return 400 when comment body contains only whitespace', async () => {
      await request(app.getHttpServer())
        .post(`/api/articles/${mainArticleSlug}/comments`)
        .set('Authorization', `Token ${commenterToken}`)
        .send({ comment: { body: '   ' } })
        .expect(400);
    });

    it('should return localized 404 when article slug does not exist', async () => {
      const resVi = await request(app.getHttpServer())
        .post('/api/articles/non-existent-slug-999/comments?lang=vi')
        .set('Authorization', `Token ${commenterToken}`)
        .send({ comment: { body: 'Hello' } })
        .expect(404);

      expect(resVi.body.errors.body).toEqual(['Không tìm thấy bài viết']);
    });

    it('should add comment to article and return RealWorld comment envelope', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/articles/${mainArticleSlug}/comments`)
        .set('Authorization', `Token ${commenterToken}`)
        .send({ comment: { body: '  His name was my name too.  ' } })
        .expect(201);

      const { comment } = res.body;
      expect(typeof comment.id).toBe('number');
      expect(comment.body).toBe('His name was my name too.');
      expect(comment.createdAt).toBeDefined();
      expect(comment.updatedAt).toBeDefined();
      expect(comment.author).toEqual({
        username: commenterUser.username,
        bio: null,
        image: null,
        following: false,
      });

      // Clean up created comment
      await request(app.getHttpServer())
        .delete(`/api/articles/${mainArticleSlug}/comments/${comment.id}`)
        .set('Authorization', `Token ${commenterToken}`)
        .expect(204);
    });
  });

  describe('GET /api/articles/:slug/comments (Get Comments)', () => {
    let firstCommentId: number;
    let secondCommentId: number;

    beforeAll(async () => {
      const c1 = await createCommentViaApi(
        mainArticleSlug,
        commenterToken,
        'First comment',
      );
      const c2 = await createCommentViaApi(
        mainArticleSlug,
        authorToken,
        'Second comment (newest)',
      );
      firstCommentId = c1.id;
      secondCommentId = c2.id;
    });

    afterEach(async () => {
      await request(app.getHttpServer())
        .delete(`/api/profiles/${commenterUser.username}/follow`)
        .set('Authorization', `Token ${authorToken}`);
    });

    afterAll(async () => {
      await request(app.getHttpServer())
        .delete(`/api/articles/${mainArticleSlug}/comments/${firstCommentId}`)
        .set('Authorization', `Token ${authorToken}`);
      await request(app.getHttpServer())
        .delete(`/api/articles/${mainArticleSlug}/comments/${secondCommentId}`)
        .set('Authorization', `Token ${authorToken}`);
    });

    it('should return comments newest-first with following=false when unauthenticated', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/articles/${mainArticleSlug}/comments`)
        .expect(200);

      expect(res.body.comments).toHaveLength(2);
      expect(res.body.comments[0].id).toBe(secondCommentId);
      expect(res.body.comments[1].id).toBe(firstCommentId);
      expect(res.body.comments[0].author.following).toBe(false);
      expect(res.body.comments[1].author.following).toBe(false);
    });

    it('should reflect following=true for followed commenter when authenticated', async () => {
      await request(app.getHttpServer())
        .post(`/api/profiles/${commenterUser.username}/follow`)
        .set('Authorization', `Token ${authorToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/api/articles/${mainArticleSlug}/comments`)
        .set('Authorization', `Token ${authorToken}`)
        .expect(200);

      const commenterEntry = res.body.comments.find(
        (c: { id: number }) => c.id === firstCommentId,
      );
      expect(commenterEntry).toBeDefined();
      expect(commenterEntry.author.following).toBe(true);
    });

    it('should return 404 when getting comments for non-existent article', async () => {
      await request(app.getHttpServer())
        .get('/api/articles/does-not-exist-999/comments')
        .expect(404);
    });
  });

  describe('DELETE /api/articles/:slug/comments/:id (Delete Comment)', () => {
    let commentId: number;

    beforeEach(async () => {
      const created = await createCommentViaApi(
        mainArticleSlug,
        commenterToken,
        'Deletable comment',
      );
      commentId = created.id;
    });

    afterEach(async () => {
      await request(app.getHttpServer())
        .delete(`/api/articles/${mainArticleSlug}/comments/${commentId}`)
        .set('Authorization', `Token ${authorToken}`);
    });

    it('should return 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .delete(`/api/articles/${mainArticleSlug}/comments/${commentId}`)
        .expect(401);
    });

    it('should return 400 when comment id is not a valid integer', async () => {
      await request(app.getHttpServer())
        .delete(`/api/articles/${mainArticleSlug}/comments/not-a-number`)
        .set('Authorization', `Token ${commenterToken}`)
        .expect(400);
    });

    it('should return localized 403 when stranger tries to delete comment', async () => {
      const resVi = await request(app.getHttpServer())
        .delete(
          `/api/articles/${mainArticleSlug}/comments/${commentId}?lang=vi`,
        )
        .set('Authorization', `Token ${strangerToken}`)
        .expect(403);

      expect(resVi.body.errors.body).toEqual([
        'Bạn không có quyền xóa bình luận này',
      ]);
    });

    it('should return localized 404 when comment does not belong to the given article slug', async () => {
      const resVi = await request(app.getHttpServer())
        .delete(
          `/api/articles/${otherArticleSlug}/comments/${commentId}?lang=vi`,
        )
        .set('Authorization', `Token ${commenterToken}`)
        .expect(404);

      expect(resVi.body.errors.body).toEqual(['Không tìm thấy bình luận']);
    });

    it('should allow comment author to delete their own comment (204)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/articles/${mainArticleSlug}/comments/${commentId}`)
        .set('Authorization', `Token ${commenterToken}`)
        .expect(204);

      // Deleting again returns 404
      await request(app.getHttpServer())
        .delete(`/api/articles/${mainArticleSlug}/comments/${commentId}`)
        .set('Authorization', `Token ${commenterToken}`)
        .expect(404);
    });

    it('should allow article author to delete another user comment on their article (204)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/articles/${mainArticleSlug}/comments/${commentId}`)
        .set('Authorization', `Token ${authorToken}`)
        .expect(204);
    });
  });
});
