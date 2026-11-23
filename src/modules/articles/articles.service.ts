import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { EntityManager, In, Repository } from 'typeorm';
import { translateWithContext } from '../../common/utils/i18n.helper.js';
import { generateUniqueSlug } from '../../common/utils/slug.util.js';
import { Follow } from '../profiles/entities/follow.entity.js';
import { User } from '../users/entities/user.entity.js';
import {
  DEFAULT_ARTICLES_LIMIT,
  DEFAULT_ARTICLES_OFFSET,
} from './articles.constants.js';
import {
  ArticleDataDto,
  ArticleResponseDto,
  MultipleArticlesResponseDto,
} from './dto/article-response.dto.js';
import { CreateArticleDataDto } from './dto/create-article.dto.js';
import {
  FeedArticlesQueryDto,
  ListArticlesQueryDto,
} from './dto/list-articles-query.dto.js';
import { UpdateArticleDataDto } from './dto/update-article.dto.js';
import { ArticleFavorite } from './entities/article-favorite.entity.js';
import { Article } from './entities/article.entity.js';
import { Tag } from './entities/tag.entity.js';

const MYSQL_ER_DUP_ENTRY = 'ER_DUP_ENTRY';
const MYSQL_ERRNO_DUP_ENTRY = 1062;
const MAX_SLUG_GENERATION_ATTEMPTS = 3;

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    @InjectRepository(ArticleFavorite)
    private readonly articleFavoriteRepository: Repository<ArticleFavorite>,
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    private readonly i18n: I18nService,
  ) {}

  async createArticle(
    dto: CreateArticleDataDto,
    currentUser: User,
  ): Promise<ArticleResponseDto> {
    const trimmedTitle = dto.title.trim();

    for (let attempt = 1; attempt <= MAX_SLUG_GENERATION_ATTEMPTS; attempt++) {
      try {
        const savedArticle = await this.articleRepository.manager.transaction(
          async (manager) => {
            const tags = await this.findOrCreateTagsInTx(
              manager,
              dto.tagList ?? [],
            );

            const article = manager.create(Article, {
              slug: generateUniqueSlug(trimmedTitle),
              title: trimmedTitle,
              description: dto.description.trim(),
              body: dto.body,
              authorId: currentUser.id,
              author: currentUser,
              tags,
            });

            return manager.save(Article, article);
          },
        );

        const [hydrated] = await this.hydrateArticles(
          [savedArticle],
          currentUser,
        );
        return { article: hydrated };
      } catch (error: unknown) {
        if (
          this.isDuplicateEntryError(error) &&
          attempt < MAX_SLUG_GENERATION_ATTEMPTS
        ) {
          continue;
        }
        throw error;
      }
    }

    throw new Error('Failed to generate unique article slug');
  }

  async listArticles(
    query: ListArticlesQueryDto,
    currentUser?: User | null,
  ): Promise<MultipleArticlesResponseDto> {
    const limit = query.limit ?? DEFAULT_ARTICLES_LIMIT;
    const offset = query.offset ?? DEFAULT_ARTICLES_OFFSET;

    const qb = this.articleRepository
      .createQueryBuilder('article')
      .select(['article.id', 'article.createdAt']);

    if (query.tag) {
      const normalizedTag = query.tag.trim().toLowerCase();
      qb.innerJoin('article.tags', 'filterTag', 'filterTag.name = :tagName', {
        tagName: normalizedTag,
      });
    }

    if (query.author) {
      qb.innerJoin(
        'article.author',
        'filterAuthor',
        'filterAuthor.username = :authorUsername',
        { authorUsername: query.author.trim() },
      );
    }

    if (query.favorited) {
      qb.innerJoin(
        ArticleFavorite,
        'filterFav',
        'filterFav.articleId = article.id',
      ).innerJoin(
        'filterFav.user',
        'favUser',
        'favUser.username = :favoritedUsername',
        { favoritedUsername: query.favorited.trim() },
      );
    }

    const [articleRows, articlesCount] = await qb
      .orderBy('article.createdAt', 'DESC')
      .addOrderBy('article.id', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    if (articleRows.length === 0) {
      return { articles: [], articlesCount };
    }

    const orderedArticles = await this.fetchOrderedArticlesByIds(
      articleRows.map((item) => item.id),
    );
    const articles = await this.hydrateArticles(orderedArticles, currentUser);

    return { articles, articlesCount };
  }

  async getFeed(
    query: FeedArticlesQueryDto,
    currentUser: User,
  ): Promise<MultipleArticlesResponseDto> {
    const limit = query.limit ?? DEFAULT_ARTICLES_LIMIT;
    const offset = query.offset ?? DEFAULT_ARTICLES_OFFSET;

    const followedRows = await this.followRepository.find({
      where: { followerId: currentUser.id },
      select: { followingId: true },
    });
    const followedAuthorIds = followedRows.map((row) => row.followingId);

    if (followedAuthorIds.length === 0) {
      return { articles: [], articlesCount: 0 };
    }

    const [articleRows, articlesCount] = await this.articleRepository
      .createQueryBuilder('article')
      .select(['article.id', 'article.createdAt'])
      .where('article.authorId IN (:...followedAuthorIds)', {
        followedAuthorIds,
      })
      .orderBy('article.createdAt', 'DESC')
      .addOrderBy('article.id', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    if (articleRows.length === 0) {
      return { articles: [], articlesCount };
    }

    const orderedArticles = await this.fetchOrderedArticlesByIds(
      articleRows.map((item) => item.id),
    );
    const articles = await this.hydrateArticles(orderedArticles, currentUser);

    return { articles, articlesCount };
  }

  async getArticleBySlug(
    slug: string,
    currentUser?: User | null,
  ): Promise<ArticleResponseDto> {
    const article = await this.findArticleEntityOrThrow(slug);
    const [hydrated] = await this.hydrateArticles([article], currentUser);
    return { article: hydrated };
  }

  async updateArticle(
    slug: string,
    dto: UpdateArticleDataDto,
    currentUser: User,
  ): Promise<ArticleResponseDto> {
    const article = await this.findArticleEntityOrThrow(slug);

    if (article.authorId !== currentUser.id) {
      throw new ForbiddenException(
        translateWithContext(this.i18n, 'errors.ARTICLE_FORBIDDEN_UPDATE'),
      );
    }

    const savedArticle = await this.articleRepository.manager.transaction(
      async (manager) => {
        if (dto.title !== undefined) {
          const trimmedTitle = dto.title.trim();
          if (trimmedTitle !== article.title) {
            article.title = trimmedTitle;
            article.slug = generateUniqueSlug(trimmedTitle);
          }
        }

        if (dto.description !== undefined) {
          article.description = dto.description.trim();
        }

        if (dto.body !== undefined) {
          article.body = dto.body;
        }

        if (dto.tagList !== undefined) {
          article.tags = await this.findOrCreateTagsInTx(manager, dto.tagList);
        }

        return manager.save(Article, article);
      },
    );

    const [hydrated] = await this.hydrateArticles([savedArticle], currentUser);
    return { article: hydrated };
  }

  async deleteArticle(slug: string, currentUser: User): Promise<void> {
    const article = await this.findArticleEntityOrThrow(slug);

    if (article.authorId !== currentUser.id) {
      throw new ForbiddenException(
        translateWithContext(this.i18n, 'errors.ARTICLE_FORBIDDEN_DELETE'),
      );
    }

    await this.articleRepository.delete({ id: article.id });
  }

  async favoriteArticle(
    slug: string,
    currentUser: User,
  ): Promise<ArticleResponseDto> {
    const article = await this.findArticleEntityOrThrow(slug);

    const existingFavorite = await this.articleFavoriteRepository.findOne({
      where: {
        userId: currentUser.id,
        articleId: article.id,
      },
    });

    if (!existingFavorite) {
      try {
        const favorite = this.articleFavoriteRepository.create({
          userId: currentUser.id,
          articleId: article.id,
        });
        await this.articleFavoriteRepository.save(favorite);
      } catch (error: unknown) {
        if (!this.isDuplicateEntryError(error)) {
          throw error;
        }
      }
    }

    const [hydrated] = await this.hydrateArticles([article], currentUser);
    return { article: hydrated };
  }

  async unfavoriteArticle(
    slug: string,
    currentUser: User,
  ): Promise<ArticleResponseDto> {
    const article = await this.findArticleEntityOrThrow(slug);

    await this.articleFavoriteRepository.delete({
      userId: currentUser.id,
      articleId: article.id,
    });

    const [hydrated] = await this.hydrateArticles([article], currentUser);
    return { article: hydrated };
  }

  private async findArticleEntityOrThrow(slug: string): Promise<Article> {
    const article = await this.articleRepository.findOne({
      where: { slug },
      relations: { author: true, tags: true },
    });

    if (!article) {
      throw new NotFoundException(
        translateWithContext(this.i18n, 'errors.ARTICLE_NOT_FOUND'),
      );
    }

    return article;
  }

  private async fetchOrderedArticlesByIds(
    articleIds: number[],
  ): Promise<Article[]> {
    const articles = await this.articleRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.author', 'author')
      .leftJoinAndSelect('article.tags', 'tag')
      .where('article.id IN (:...articleIds)', { articleIds })
      .getMany();

    const articleById = new Map(articles.map((item) => [item.id, item]));
    return articleIds
      .map((id) => articleById.get(id))
      .filter((item): item is Article => item !== undefined);
  }

  private async hydrateArticles(
    articles: Article[],
    currentUser?: User | null,
  ): Promise<ArticleDataDto[]> {
    if (articles.length === 0) {
      return [];
    }

    const articleIds = articles.map((item) => item.id);
    const authorIds = [...new Set(articles.map((item) => item.authorId))];

    const rawCounts = await this.articleFavoriteRepository
      .createQueryBuilder('fav')
      .select('fav.articleId', 'articleId')
      .addSelect('COUNT(fav.userId)', 'count')
      .where('fav.articleId IN (:...articleIds)', { articleIds })
      .groupBy('fav.articleId')
      .getRawMany<{ articleId: number | string; count: string }>();

    const favoritesCountMap = new Map<number, number>(
      rawCounts.map((row) => [Number(row.articleId), Number(row.count)]),
    );

    const favoritedSet = new Set<number>();
    const followingSet = new Set<number>();

    if (currentUser) {
      const favoritedRows = await this.articleFavoriteRepository.find({
        where: {
          userId: currentUser.id,
          articleId: In(articleIds),
        },
        select: { articleId: true },
      });
      for (const row of favoritedRows) {
        favoritedSet.add(row.articleId);
      }

      const otherAuthorIds = authorIds.filter((id) => id !== currentUser.id);
      if (otherAuthorIds.length > 0) {
        const followingRows = await this.followRepository.find({
          where: {
            followerId: currentUser.id,
            followingId: In(otherAuthorIds),
          },
          select: { followingId: true },
        });
        for (const row of followingRows) {
          followingSet.add(row.followingId);
        }
      }
    }

    return articles.map((article) => ({
      slug: article.slug,
      title: article.title,
      description: article.description,
      body: article.body,
      tagList: (article.tags ?? []).map((tag) => tag.name).sort(),
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      favorited: favoritedSet.has(article.id),
      favoritesCount: favoritesCountMap.get(article.id) ?? 0,
      author: {
        username: article.author.username,
        bio: article.author.bio,
        image: article.author.image,
        following: followingSet.has(article.authorId),
      },
    }));
  }

  private async findOrCreateTagsInTx(
    manager: EntityManager,
    rawTagNames: string[],
  ): Promise<Tag[]> {
    const normalizedNames = [
      ...new Set(
        rawTagNames
          .map((name) => name.trim().toLowerCase())
          .filter((name) => name.length > 0),
      ),
    ];

    if (normalizedNames.length === 0) {
      return [];
    }

    await manager
      .createQueryBuilder()
      .insert()
      .into(Tag)
      .values(normalizedNames.map((name) => ({ name })))
      .orIgnore()
      .execute();

    return manager.find(Tag, {
      where: { name: In(normalizedNames) },
    });
  }

  private isDuplicateEntryError(error: unknown): boolean {
    const dbError = error as { code?: string; errno?: number };
    return (
      dbError?.code === MYSQL_ER_DUP_ENTRY ||
      dbError?.errno === MYSQL_ERRNO_DUP_ENTRY
    );
  }
}
