import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource, In } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { User } from '../src/modules/users/entities/user.entity.js';

describe('Articles API (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
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

  const createArticleViaApi = async (
    token: string,
    payload: {
      title: string;
      description: string;
      body: string;
      tagList?: string[];
    },
  ) => {
    const res = await request(app.getHttpServer())
      .post('/api/articles')
      .set('Authorization', `Token ${token}`)
      .send({ article: payload })
      .expect(201);
    return res.body.article;
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
    // Deleting test users cascades cleanly to articles, article_tags, article_favorites, and follows
    await dataSource.getRepository(User).delete({
      email: In([authorUser.email, readerUser.email]),
    });
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

    it('should return 400 when title, description, or body contains only whitespace', async () => {
      await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Token ${authorToken}`)
        .send({
          article: {
            title: '   ',
            description: 'Valid description',
            body: 'Valid body',
          },
        })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Token ${authorToken}`)
        .send({
          article: {
            title: 'Valid title',
            description: '   ',
            body: 'Valid body',
          },
        })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Token ${authorToken}`)
        .send({
          article: {
            title: 'Valid title',
            description: 'Valid description',
            body: '   ',
          },
        })
        .expect(400);
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
    });
  });

  describe('POST & DELETE /api/articles/:slug/favorite', () => {
    let targetSlug: string;

    beforeEach(async () => {
      const created = await createArticleViaApi(authorToken, {
        title: `Favorite Target ${Date.now()}`,
        description: 'Favorite test description',
        body: 'Favorite test body',
      });
      targetSlug = created.slug;
    });

    afterEach(async () => {
      await request(app.getHttpServer())
        .delete(`/api/articles/${targetSlug}`)
        .set('Authorization', `Token ${authorToken}`);
    });

    it('should favorite an article and increment favoritesCount idempotently', async () => {
      const res1 = await request(app.getHttpServer())
        .post(`/api/articles/${targetSlug}/favorite`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      expect(res1.body.article.favorited).toBe(true);
      expect(res1.body.article.favoritesCount).toBe(1);

      const res2 = await request(app.getHttpServer())
        .post(`/api/articles/${targetSlug}/favorite`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      expect(res2.body.article.favorited).toBe(true);
      expect(res2.body.article.favoritesCount).toBe(1);
    });

    it('should unfavorite an article and decrement favoritesCount', async () => {
      await request(app.getHttpServer())
        .post(`/api/articles/${targetSlug}/favorite`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .delete(`/api/articles/${targetSlug}/favorite`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      expect(res.body.article.favorited).toBe(false);
      expect(res.body.article.favoritesCount).toBe(0);
    });
  });

  describe('GET /api/articles & GET /api/articles/feed', () => {
    const filterTag = `tag_${uniqueSuffix}`;
    const paginationTag = `page_${uniqueSuffix}`;
    let olderAuthorSlug: string;
    let newerAuthorSlug: string;

    beforeAll(async () => {
      const olderArticle = await createArticleViaApi(authorToken, {
        title: 'First Article Older',
        description: 'First seeded article',
        body: 'Body 1',
        tagList: [filterTag, paginationTag, 'typeorm'],
      });
      olderAuthorSlug = olderArticle.slug;

      const newerArticle = await createArticleViaApi(authorToken, {
        title: 'Second Article Newer',
        description: 'Second seeded article',
        body: 'Body 2',
        tagList: [paginationTag, 'nestjs'],
      });
      newerAuthorSlug = newerArticle.slug;

      await createArticleViaApi(readerToken, {
        title: 'Reader Own Article',
        description: 'Written by reader',
        body: 'Body 3',
        tagList: ['reactjs'],
      });

      await request(app.getHttpServer())
        .post(`/api/articles/${olderAuthorSlug}/favorite`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);
    });

    afterEach(async () => {
      // Ensure follow state does not leak between tests
      await request(app.getHttpServer())
        .delete(`/api/profiles/${authorUser.username}/follow`)
        .set('Authorization', `Token ${readerToken}`);
    });

    it('should filter by tag while returning ALL tags belonging to matching articles', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/articles?tag=${filterTag}`)
        .expect(200);

      expect(response.body.articlesCount).toBe(1);
      expect(response.body.articles[0].slug).toBe(olderAuthorSlug);
      expect(response.body.articles[0].tagList).toEqual(
        [filterTag, paginationTag, 'typeorm'].sort(),
      );
    });

    it('should filter by author and favorited username', async () => {
      const byAuthor = await request(app.getHttpServer())
        .get(`/api/articles?author=${authorUser.username}`)
        .expect(200);

      expect(byAuthor.body.articlesCount).toBeGreaterThanOrEqual(2);

      const byFavorited = await request(app.getHttpServer())
        .get(`/api/articles?favorited=${readerUser.username}`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      expect(byFavorited.body.articlesCount).toBe(1);
      expect(byFavorited.body.articles[0].slug).toBe(olderAuthorSlug);
      expect(byFavorited.body.articles[0].favorited).toBe(true);
    });

    it('should paginate with limit and offset in newest-first order', async () => {
      const page1 = await request(app.getHttpServer())
        .get(`/api/articles?tag=${paginationTag}&limit=1&offset=0`)
        .expect(200);

      const page2 = await request(app.getHttpServer())
        .get(`/api/articles?tag=${paginationTag}&limit=1&offset=1`)
        .expect(200);

      expect(page1.body.articles.length).toBe(1);
      expect(page2.body.articles.length).toBe(1);
      expect(page1.body.articlesCount).toBe(2);
      expect(page2.body.articlesCount).toBe(2);
      expect(page1.body.articles[0].slug).toBe(newerAuthorSlug);
      expect(page2.body.articles[0].slug).toBe(olderAuthorSlug);
      expect(page1.body.articles[0].slug).not.toBe(page2.body.articles[0].slug);
    });

    it('should return empty feed before following anyone, then include followed author articles', async () => {
      await request(app.getHttpServer()).get('/api/articles/feed').expect(401);

      const emptyFeed = await request(app.getHttpServer())
        .get('/api/articles/feed')
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      expect(emptyFeed.body).toEqual({ articles: [], articlesCount: 0 });

      await request(app.getHttpServer())
        .post(`/api/profiles/${authorUser.username}/follow`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      const feedRes = await request(app.getHttpServer())
        .get('/api/articles/feed')
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      expect(feedRes.body.articlesCount).toBeGreaterThanOrEqual(2);
      expect(feedRes.body.articles[0].slug).toBe(newerAuthorSlug);
      expect(feedRes.body.articles[0].author.following).toBe(true);
    });
  });

  describe('GET /api/articles/:slug', () => {
    let seededSlug: string;

    beforeAll(async () => {
      const article = await createArticleViaApi(authorToken, {
        title: 'Single Fetch Article',
        description: 'Single fetch desc',
        body: 'Single fetch body',
      });
      seededSlug = article.slug;
    });

    it('should get a single article by slug', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/articles/${seededSlug}`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      expect(res.body.article.slug).toBe(seededSlug);
      expect(res.body.article.author.username).toBe(authorUser.username);
    });

    it('should return localized 404 when article is not found', async () => {
      const resVi = await request(app.getHttpServer())
        .get('/api/articles/non-existent-slug-999?lang=vi')
        .expect(404);

      expect(resVi.body.errors.body).toEqual(['Không tìm thấy bài viết']);
    });
  });

  describe('PUT & DELETE /api/articles/:slug', () => {
    let mutableSlug: string;

    beforeEach(async () => {
      const article = await createArticleViaApi(authorToken, {
        title: `Mutable Article ${Date.now()}`,
        description: 'Initial desc',
        body: 'Initial body',
        tagList: ['initial'],
      });
      mutableSlug = article.slug;
    });

    it('should return 400 when updating title, description, or body with whitespace-only strings', async () => {
      await request(app.getHttpServer())
        .put(`/api/articles/${mutableSlug}`)
        .set('Authorization', `Token ${authorToken}`)
        .send({ article: { title: '   ' } })
        .expect(400);

      await request(app.getHttpServer())
        .put(`/api/articles/${mutableSlug}`)
        .set('Authorization', `Token ${authorToken}`)
        .send({ article: { description: '   ' } })
        .expect(400);

      await request(app.getHttpServer())
        .put(`/api/articles/${mutableSlug}`)
        .set('Authorization', `Token ${authorToken}`)
        .send({ article: { body: '   ' } })
        .expect(400);
    });

    it('should return localized 403 when non-author attempts update or delete', async () => {
      const updateForbidden = await request(app.getHttpServer())
        .put(`/api/articles/${mutableSlug}?lang=vi`)
        .set('Authorization', `Token ${readerToken}`)
        .send({ article: { title: 'Unauthorized Edit' } })
        .expect(403);

      expect(updateForbidden.body.errors.body).toEqual([
        'Bạn không có quyền chỉnh sửa bài viết này',
      ]);

      const deleteForbidden = await request(app.getHttpServer())
        .delete(`/api/articles/${mutableSlug}?lang=vi`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(403);

      expect(deleteForbidden.body.errors.body).toEqual([
        'Bạn không có quyền xóa bài viết này',
      ]);
    });

    it('should update article title/tags and regenerate slug when requested by author', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/articles/${mutableSlug}`)
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

      await request(app.getHttpServer())
        .get(`/api/articles/${mutableSlug}`)
        .expect(404);
    });

    it('should delete article (204) when requested by author', async () => {
      await request(app.getHttpServer())
        .delete(`/api/articles/${mutableSlug}`)
        .set('Authorization', `Token ${authorToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/api/articles/${mutableSlug}`)
        .expect(404);
    });
  });
});
