import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { Article } from '../articles/entities/article.entity.js';
import { Follow } from '../profiles/entities/follow.entity.js';
import { User } from '../users/entities/user.entity.js';
import { CommentsService } from './comments.service.js';
import { Comment } from './entities/comment.entity.js';

describe('CommentsService', () => {
  let service: CommentsService;

  const articleAuthor: User = {
    id: 1,
    username: 'article_author',
    email: 'author@example.com',
    password: 'hashed-password',
    bio: 'Article author bio',
    image: null,
    tokenVersion: 1,
    createdAt: new Date('2026-11-25T00:00:00Z'),
    updatedAt: new Date('2026-11-25T00:00:00Z'),
  };

  const commenter: User = {
    id: 2,
    username: 'commenter',
    email: 'commenter@example.com',
    password: 'hashed-password',
    bio: 'Commenter bio',
    image: null,
    tokenVersion: 1,
    createdAt: new Date('2026-11-25T00:00:00Z'),
    updatedAt: new Date('2026-11-25T00:00:00Z'),
  };

  const stranger: User = {
    id: 3,
    username: 'stranger',
    email: 'stranger@example.com',
    password: 'hashed-password',
    bio: null,
    image: null,
    tokenVersion: 1,
    createdAt: new Date('2026-11-25T00:00:00Z'),
    updatedAt: new Date('2026-11-25T00:00:00Z'),
  };

  const sampleArticle = {
    id: 10,
    slug: 'sample-article-a1b2c3',
    authorId: articleAuthor.id,
  };

  const sampleComment: Comment = {
    id: 100,
    body: 'Great article!',
    articleId: 10,
    authorId: commenter.id,
    article: sampleArticle as Article,
    author: commenter,
    createdAt: new Date('2026-11-25T01:00:00Z'),
    updatedAt: new Date('2026-11-25T01:00:00Z'),
  };

  let mockCommentRepository: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  let mockArticleRepository: {
    findOne: ReturnType<typeof vi.fn>;
  };

  let mockFollowRepository: {
    find: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockCommentRepository = {
      create: vi.fn().mockImplementation((data) => ({
        ...data,
        id: 100,
        createdAt: new Date('2026-11-25T01:00:00Z'),
        updatedAt: new Date('2026-11-25T01:00:00Z'),
      })),
      save: vi.fn().mockImplementation((data) => Promise.resolve(data)),
      find: vi.fn().mockResolvedValue([sampleComment]),
      findOne: vi.fn().mockResolvedValue(sampleComment),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
    };

    mockArticleRepository = {
      findOne: vi.fn().mockResolvedValue(sampleArticle),
    };

    mockFollowRepository = {
      find: vi.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        {
          provide: getRepositoryToken(Comment),
          useValue: mockCommentRepository,
        },
        {
          provide: getRepositoryToken(Article),
          useValue: mockArticleRepository,
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

    service = module.get<CommentsService>(CommentsService);
  });

  describe('addComment', () => {
    it('should create comment on existing article and return RealWorld envelope', async () => {
      const result = await service.addComment(
        sampleArticle.slug,
        { body: 'Great article!' },
        commenter,
      );

      expect(result.comment.id).toBe(100);
      expect(result.comment.body).toBe('Great article!');
      expect(result.comment.author.username).toBe(commenter.username);
      expect(result.comment.author.following).toBe(false);
    });

    it('should throw NotFoundException if article does not exist', async () => {
      mockArticleRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.addComment('missing-slug', { body: 'Hello' }, commenter),
      ).rejects.toThrow(new NotFoundException('errors.ARTICLE_NOT_FOUND'));
    });
  });

  describe('getComments', () => {
    it('should return comments with following status batch-hydrated for authenticated user', async () => {
      mockFollowRepository.find.mockResolvedValueOnce([
        { followingId: commenter.id },
      ]);

      const result = await service.getComments(
        sampleArticle.slug,
        articleAuthor,
      );

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].body).toBe('Great article!');
      expect(result.comments[0].author.following).toBe(true);
      expect(mockCommentRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          select: {
            id: true,
            body: true,
            authorId: true,
            createdAt: true,
            updatedAt: true,
            author: {
              id: true,
              username: true,
              bio: true,
              image: true,
            },
          },
        }),
      );
    });

    it('should return comments with following=false when unauthenticated', async () => {
      const result = await service.getComments(sampleArticle.slug, null);

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].author.following).toBe(false);
      expect(mockFollowRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('deleteComment', () => {
    it('should allow comment author to delete their own comment', async () => {
      await service.deleteComment(sampleArticle.slug, 100, commenter);
      expect(mockCommentRepository.findOne).toHaveBeenCalledWith({
        where: { id: 100, articleId: sampleArticle.id },
        select: { id: true, authorId: true },
      });
      expect(mockCommentRepository.delete).toHaveBeenCalledWith({ id: 100 });
    });

    it('should allow article author to delete another user comment on their article', async () => {
      await service.deleteComment(sampleArticle.slug, 100, articleAuthor);
      expect(mockCommentRepository.delete).toHaveBeenCalledWith({ id: 100 });
    });

    it('should throw ForbiddenException if stranger attempts to delete comment', async () => {
      await expect(
        service.deleteComment(sampleArticle.slug, 100, stranger),
      ).rejects.toThrow(
        new ForbiddenException('errors.COMMENT_FORBIDDEN_DELETE'),
      );
      expect(mockCommentRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if comment does not exist on that article', async () => {
      mockCommentRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.deleteComment(sampleArticle.slug, 999, commenter),
      ).rejects.toThrow(new NotFoundException('errors.COMMENT_NOT_FOUND'));
    });
  });
});
