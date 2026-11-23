import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { Follow } from '../profiles/entities/follow.entity.js';
import { User } from '../users/entities/user.entity.js';
import { ArticlesService } from './articles.service.js';
import { ArticleFavorite } from './entities/article-favorite.entity.js';
import { Article } from './entities/article.entity.js';
import { Tag } from './entities/tag.entity.js';

describe('ArticlesService', () => {
  let service: ArticlesService;

  const authorUser: User = {
    id: 1,
    username: 'jake',
    email: 'jake@example.com',
    password: 'hashed-password',
    bio: 'Author bio',
    image: null,
    tokenVersion: 1,
    createdAt: new Date('2026-11-23T00:00:00Z'),
    updatedAt: new Date('2026-11-23T00:00:00Z'),
  };

  const otherUser: User = {
    id: 2,
    username: 'bob',
    email: 'bob@example.com',
    password: 'hashed-password',
    bio: null,
    image: null,
    tokenVersion: 1,
    createdAt: new Date('2026-11-23T00:00:00Z'),
    updatedAt: new Date('2026-11-23T00:00:00Z'),
  };

  const sampleArticle: Article = {
    id: 10,
    slug: 'how-to-train-your-dragon-a1b2c3',
    title: 'How to train your dragon',
    description: 'Ever wonder how?',
    body: 'You have to believe',
    authorId: 1,
    author: authorUser,
    tags: [
      { id: 1, name: 'dragons', createdAt: new Date() },
      { id: 2, name: 'training', createdAt: new Date() },
    ],
    createdAt: new Date('2026-11-23T00:00:00Z'),
    updatedAt: new Date('2026-11-23T00:00:00Z'),
  };

  let mockInsertQb: {
    insert: ReturnType<typeof vi.fn>;
    into: ReturnType<typeof vi.fn>;
    values: ReturnType<typeof vi.fn>;
    orIgnore: ReturnType<typeof vi.fn>;
    execute: ReturnType<typeof vi.fn>;
  };

  let mockManager: {
    createQueryBuilder: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  let mockFavCountQb: {
    select: ReturnType<typeof vi.fn>;
    addSelect: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
    getRawMany: ReturnType<typeof vi.fn>;
  };

  let mockArticleRepository: {
    findOne: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
    manager: {
      transaction: ReturnType<typeof vi.fn>;
    };
  };

  let mockArticleFavoriteRepository: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };

  let mockFollowRepository: {
    find: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockInsertQb = {
      insert: vi.fn().mockReturnThis(),
      into: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      orIgnore: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(undefined),
    };

    mockManager = {
      createQueryBuilder: vi.fn().mockReturnValue(mockInsertQb),
      find: vi.fn().mockResolvedValue(sampleArticle.tags),
      create: vi.fn().mockImplementation((_entity, data) => ({
        ...data,
        id: 10,
        createdAt: new Date('2026-11-23T00:00:00Z'),
        updatedAt: new Date('2026-11-23T00:00:00Z'),
      })),
      save: vi.fn().mockImplementation((_entity, data) => Promise.resolve(data)),
    };

    mockFavCountQb = {
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      getRawMany: vi.fn().mockResolvedValue([]),
    };

    mockArticleRepository = {
      findOne: vi.fn().mockResolvedValue(sampleArticle),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: vi.fn(),
      manager: {
        transaction: vi
          .fn()
          .mockImplementation((callback) => callback(mockManager)),
      },
    };

    mockArticleFavoriteRepository = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((data) => data),
      save: vi.fn().mockImplementation((data) => Promise.resolve(data)),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: vi.fn().mockReturnValue(mockFavCountQb),
    };

    mockFollowRepository = {
      find: vi.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        {
          provide: getRepositoryToken(Article),
          useValue: mockArticleRepository,
        },
        {
          provide: getRepositoryToken(Tag),
          useValue: {},
        },
        {
          provide: getRepositoryToken(ArticleFavorite),
          useValue: mockArticleFavoriteRepository,
        },
        {
          provide: getRepositoryToken(Follow),
          useValue: mockFollowRepository,
        },
        {
          provide: I18nService,
          useValue: { t: vi.fn((key: string) => key) },
        },
      ],
    }).compile();

    service = module.get<ArticlesService>(ArticlesService);
  });

  describe('createArticle', () => {
    it('should normalize/deduplicate tags via orIgnore, generate slug, and save article in transaction', async () => {
      const result = await service.createArticle(
        {
          title: 'How to train your dragon',
          description: 'Ever wonder how?',
          body: 'You have to believe',
          tagList: [' Dragons ', 'training', 'dragons'],
        },
        authorUser,
      );

      expect(mockInsertQb.orIgnore).toHaveBeenCalled();
      expect(mockInsertQb.values).toHaveBeenCalledWith([
        { name: 'dragons' },
        { name: 'training' },
      ]);
      expect(result.article.slug).toMatch(/^how-to-train-your-dragon-[0-9a-f]{6}$/);
      expect(result.article.tagList).toEqual(['dragons', 'training']);
      expect(result.article.favoritesCount).toBe(0);
      expect(result.article.favorited).toBe(false);
    });
  });

  describe('getArticleBySlug', () => {
    it('should return formatted article when found', async () => {
      const result = await service.getArticleBySlug(sampleArticle.slug, null);

      expect(result.article.slug).toBe(sampleArticle.slug);
      expect(result.article.author.username).toBe('jake');
      expect(result.article.tagList).toEqual(['dragons', 'training']);
    });

    it('should throw NotFoundException when article does not exist', async () => {
      mockArticleRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.getArticleBySlug('missing-slug', null),
      ).rejects.toThrow(new NotFoundException('errors.ARTICLE_NOT_FOUND'));
    });
  });

  describe('updateArticle', () => {
    it('should throw ForbiddenException if non-author attempts update', async () => {
      await expect(
        service.updateArticle(
          sampleArticle.slug,
          { title: 'Hacked Title' },
          otherUser,
        ),
      ).rejects.toThrow(
        new ForbiddenException('errors.ARTICLE_FORBIDDEN_UPDATE'),
      );
    });

    it('should regenerate slug when title is updated by author', async () => {
      const existing = Object.assign(new Article(), sampleArticle);
      mockArticleRepository.findOne.mockResolvedValueOnce(existing);

      const result = await service.updateArticle(
        sampleArticle.slug,
        { title: 'New Dragon Guide' },
        authorUser,
      );

      expect(result.article.title).toBe('New Dragon Guide');
      expect(result.article.slug).toMatch(/^new-dragon-guide-[0-9a-f]{6}$/);
    });
  });

  describe('deleteArticle', () => {
    it('should throw ForbiddenException if non-author attempts delete', async () => {
      await expect(
        service.deleteArticle(sampleArticle.slug, otherUser),
      ).rejects.toThrow(
        new ForbiddenException('errors.ARTICLE_FORBIDDEN_DELETE'),
      );
      expect(mockArticleRepository.delete).not.toHaveBeenCalled();
    });

    it('should delete article when requested by author', async () => {
      await service.deleteArticle(sampleArticle.slug, authorUser);
      expect(mockArticleRepository.delete).toHaveBeenCalledWith({
        id: sampleArticle.id,
      });
    });
  });

  describe('favoriteArticle & unfavoriteArticle', () => {
    it('should favorite article and handle ER_DUP_ENTRY idempotently', async () => {
      mockArticleFavoriteRepository.save.mockRejectedValueOnce({
        code: 'ER_DUP_ENTRY',
        errno: 1062,
      });
      mockFavCountQb.getRawMany.mockResolvedValueOnce([
        { articleId: 10, count: '1' },
      ]);
      mockArticleFavoriteRepository.find.mockResolvedValueOnce([
        { articleId: 10 },
      ]);

      const result = await service.favoriteArticle(sampleArticle.slug, otherUser);

      expect(result.article.favorited).toBe(true);
      expect(result.article.favoritesCount).toBe(1);
    });

    it('should unfavorite article and return favorited=false', async () => {
      const result = await service.unfavoriteArticle(
        sampleArticle.slug,
        otherUser,
      );

      expect(mockArticleFavoriteRepository.delete).toHaveBeenCalledWith({
        userId: otherUser.id,
        articleId: sampleArticle.id,
      });
      expect(result.article.favorited).toBe(false);
    });
  });

  describe('getFeed', () => {
    it('should return empty feed immediately when user follows nobody', async () => {
      mockFollowRepository.find.mockResolvedValueOnce([]);

      const result = await service.getFeed({ limit: 20, offset: 0 }, otherUser);

      expect(result).toEqual({ articles: [], articlesCount: 0 });
      expect(mockArticleRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
