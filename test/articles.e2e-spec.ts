import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';

describe('Articles API (e2e)', () => {
  let app: INestApplication<App>;
  const uniqueSuffix = Date.now().toString();

  const authorUser = {
    username: `writer_${uniqueSuffix}`,
    email: `writer_${uniqueSuffix}@example.com`,
    password: 'Password123!',
  };

  const readerUser = {
    username: `reader_${uniqueSuffix}`,
    email: `reader_${uniqueSuffix}@example.com`,
    password: 'Password123!',
  };

  let authorToken: string;
  let readerToken: string;
  let articleSlug1: string;
  let articleSlug2: string;

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

    const resAuthor = await request(app.getHttpServer())
      .post('/api/users')
      .send({ user: authorUser })
      .expect(201);
    authorToken = resAuthor.body.user.token;

    const resReader = await request(app.getHttpServer())
      .post('/api/users')
      .send({ user: readerUser })
      .expect(201);
    readerToken = resReader.body.user.token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/articles (Create Article)', () => {
    it('should return 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .post('/api/articles')
        .send({
          article: {
            title: 'Unauthorized Article',
            description: 'Desc',
            body: 'Body',
          },
        })
        .expect(401);
    });

    it('should create article with Vietnamese slug, normalized tags, and RealWorld envelope', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Token ${authorToken}`)
        .send({
          article: {
            title: 'Hướng dẫn NestJS',
            description: 'Học NestJS với MySQL 8',
            body: 'Nội dung chi tiết về NestJS và TypeORM.',
            tagList: ['NestJS', 'typeorm', 'nestjs'],
          },
        })
        .expect(201);

      const { article } = response.body;
      expect(article.slug).toMatch(/^huong-dan-nestjs-[0-9a-f]{6}$/);
      expect(article.title).toBe('Hướng dẫn NestJS');
      expect(article.tagList).toEqual(['nestjs', 'typeorm']);
      expect(article.favorited).toBe(false);
      expect(article.favoritesCount).toBe(0);
      expect(article.author.username).toBe(authorUser.username);
      articleSlug1 = article.slug;
    });

    it('should create a second article by readerUser for filter and feed tests', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Token ${readerToken}`)
        .send({
          article: {
            title: 'ReactJS Deep Dive',
            description: 'React internals',
            body: 'Hooks and reconciliation.',
            tagList: ['reactjs'],
          },
        })
        .expect(201);

      articleSlug2 = response.body.article.slug;
    });
  });

  describe('POST & DELETE /api/articles/:slug/favorite', () => {
    it('should favorite an article and increment favoritesCount idempotently', async () => {
      const res1 = await request(app.getHttpServer())
        .post(`/api/articles/${articleSlug1}/favorite`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      expect(res1.body.article.favorited).toBe(true);
      expect(res1.body.article.favoritesCount).toBe(1);

      // Idempotent second favorite call must not fail or double count
      const res2 = await request(app.getHttpServer())
        .post(`/api/articles/${articleSlug1}/favorite`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      expect(res2.body.article.favorited).toBe(true);
      expect(res2.body.article.favoritesCount).toBe(1);
    });

    it('should unfavorite an article and decrement favoritesCount', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/articles/${articleSlug1}/favorite`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      expect(res.body.article.favorited).toBe(false);
      expect(res.body.article.favoritesCount).toBe(0);

      // Re-favorite for filter tests below
      await request(app.getHttpServer())
        .post(`/api/articles/${articleSlug1}/favorite`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);
    });
  });

  describe('GET /api/articles & GET /api/articles/feed', () => {
    it('should filter by tag while returning ALL tags belonging to matching articles', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/articles?tag=nestjs')
        .expect(200);

      const matched = response.body.articles.find(
        (item: { slug: string }) => item.slug === articleSlug1,
      );
      expect(matched).toBeDefined();
      expect(matched.tagList).toEqual(['nestjs', 'typeorm']);
    });

    it('should filter by author and favorited username', async () => {
      const byAuthor = await request(app.getHttpServer())
        .get(`/api/articles?author=${authorUser.username}`)
        .expect(200);

      expect(byAuthor.body.articlesCount).toBe(1);
      expect(byAuthor.body.articles[0].slug).toBe(articleSlug1);

      const byFavorited = await request(app.getHttpServer())
        .get(`/api/articles?favorited=${readerUser.username}`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      expect(byFavorited.body.articlesCount).toBe(1);
      expect(byFavorited.body.articles[0].slug).toBe(articleSlug1);
      expect(byFavorited.body.articles[0].favorited).toBe(true);
    });

    it('should support limit and offset pagination', async () => {
      const page1 = await request(app.getHttpServer())
        .get(`/api/articles?limit=1&offset=0`)
        .expect(200);

      expect(page1.body.articles.length).toBe(1);
      expect(page1.body.articlesCount).toBeGreaterThanOrEqual(2);
    });

    it('should return empty feed before following anyone, then include followed author articles', async () => {
      await request(app.getHttpServer()).get('/api/articles/feed').expect(401);

      const emptyFeed = await request(app.getHttpServer())
        .get('/api/articles/feed')
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      expect(emptyFeed.body).toEqual({ articles: [], articlesCount: 0 });

      // readerUser follows authorUser
      await request(app.getHttpServer())
        .post(`/api/profiles/${authorUser.username}/follow`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      const feedRes = await request(app.getHttpServer())
        .get('/api/articles/feed')
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      expect(feedRes.body.articlesCount).toBe(1);
      expect(feedRes.body.articles[0].slug).toBe(articleSlug1);
      expect(feedRes.body.articles[0].author.following).toBe(true);
      expect(feedRes.body.articles[0].favorited).toBe(true);
      expect(feedRes.body.articles[0].favoritesCount).toBe(1);
    });
  });

  describe('GET /api/articles/:slug', () => {
    it('should get a single article by slug', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/articles/${articleSlug1}`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      expect(res.body.article.slug).toBe(articleSlug1);
      expect(res.body.article.author.following).toBe(true);
      expect(res.body.article.favorited).toBe(true);
    });

    it('should return localized 404 when article is not found', async () => {
      const resVi = await request(app.getHttpServer())
        .get('/api/articles/non-existent-slug-999?lang=vi')
        .expect(404);

      expect(resVi.body.errors.body).toEqual(['Không tìm thấy bài viết']);
    });
  });

  describe('PUT & DELETE /api/articles/:slug', () => {
    it('should return localized 403 when non-author attempts update or delete', async () => {
      const updateForbidden = await request(app.getHttpServer())
        .put(`/api/articles/${articleSlug1}?lang=vi`)
        .set('Authorization', `Token ${readerToken}`)
        .send({ article: { title: 'Unauthorized Edit' } })
        .expect(403);

      expect(updateForbidden.body.errors.body).toEqual([
        'Bạn không có quyền chỉnh sửa bài viết này',
      ]);

      const deleteForbidden = await request(app.getHttpServer())
        .delete(`/api/articles/${articleSlug1}?lang=vi`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(403);

      expect(deleteForbidden.body.errors.body).toEqual([
        'Bạn không có quyền xóa bài viết này',
      ]);
    });

    it('should update article title/tags and regenerate slug when requested by author', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/articles/${articleSlug1}`)
        .set('Authorization', `Token ${authorToken}`)
        .send({
          article: {
            title: 'NestJS Production Guide',
            tagList: ['nestjs', 'mysql'],
          },
        })
        .expect(200);

      const updated = res.body.article;
      expect(updated.title).toBe('NestJS Production Guide');
      expect(updated.slug).toMatch(/^nestjs-production-guide-[0-9a-f]{6}$/);
      expect(updated.tagList).toEqual(['mysql', 'nestjs']);
      expect(updated.favoritesCount).toBe(1);

      // Old slug should no longer resolve
      await request(app.getHttpServer())
        .get(`/api/articles/${articleSlug1}`)
        .expect(404);

      articleSlug1 = updated.slug;
    });

    it('should delete article (204) when requested by author', async () => {
      await request(app.getHttpServer())
        .delete(`/api/articles/${articleSlug1}`)
        .set('Authorization', `Token ${authorToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/api/articles/${articleSlug1}`)
        .expect(404);

      // Clean up second article as well
      await request(app.getHttpServer())
        .delete(`/api/articles/${articleSlug2}`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(204);
    });
  });
});
