import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { In, Repository } from 'typeorm';
import { translateWithContext } from '../../common/utils/i18n.helper.js';
import { Article } from '../articles/entities/article.entity.js';
import { Follow } from '../profiles/entities/follow.entity.js';
import { User } from '../users/entities/user.entity.js';
import {
  CommentDataDto,
  CommentResponseDto,
  MultipleCommentsResponseDto,
} from './dto/comment-response.dto.js';
import { CreateCommentDataDto } from './dto/create-comment.dto.js';
import { Comment } from './entities/comment.entity.js';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    private readonly i18n: I18nService,
  ) {}

  async addComment(
    slug: string,
    dto: CreateCommentDataDto,
    currentUser: User,
  ): Promise<CommentResponseDto> {
    const article = await this.findArticleBySlugOrThrow(slug);

    const comment = this.commentRepository.create({
      body: dto.body,
      articleId: article.id,
      authorId: currentUser.id,
      author: currentUser,
    });

    const savedComment = await this.commentRepository.save(comment);
    const [hydrated] = await this.hydrateComments([savedComment], currentUser);

    return { comment: hydrated };
  }

  async getComments(
    slug: string,
    currentUser?: User | null,
  ): Promise<MultipleCommentsResponseDto> {
    const article = await this.findArticleBySlugOrThrow(slug);

    const comments = await this.commentRepository.find({
      where: { articleId: article.id },
      relations: { author: true },
      order: { createdAt: 'DESC', id: 'DESC' },
    });

    const hydrated = await this.hydrateComments(comments, currentUser);
    return { comments: hydrated };
  }

  async deleteComment(
    slug: string,
    commentId: number,
    currentUser: User,
  ): Promise<void> {
    const article = await this.findArticleBySlugOrThrow(slug);

    const comment = await this.commentRepository.findOne({
      where: { id: commentId, articleId: article.id },
    });

    if (!comment) {
      throw new NotFoundException(
        translateWithContext(this.i18n, 'errors.COMMENT_NOT_FOUND'),
      );
    }

    const isCommentAuthor = comment.authorId === currentUser.id;
    const isArticleAuthor = article.authorId === currentUser.id;

    if (!isCommentAuthor && !isArticleAuthor) {
      throw new ForbiddenException(
        translateWithContext(this.i18n, 'errors.COMMENT_FORBIDDEN_DELETE'),
      );
    }

    await this.commentRepository.delete({ id: comment.id });
  }

  private async findArticleBySlugOrThrow(slug: string): Promise<Article> {
    const article = await this.articleRepository.findOne({
      where: { slug },
      select: { id: true, authorId: true, slug: true },
    });

    if (!article) {
      throw new NotFoundException(
        translateWithContext(this.i18n, 'errors.ARTICLE_NOT_FOUND'),
      );
    }

    return article;
  }

  private async hydrateComments(
    comments: Comment[],
    currentUser?: User | null,
  ): Promise<CommentDataDto[]> {
    if (comments.length === 0) {
      return [];
    }

    const followingSet = new Set<number>();

    if (currentUser) {
      const otherAuthorIds = [
        ...new Set(
          comments
            .map((item) => item.authorId)
            .filter((id) => id !== currentUser.id),
        ),
      ];

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

    return comments.map((comment) => ({
      id: comment.id,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      body: comment.body,
      author: {
        username: comment.author.username,
        bio: comment.author.bio,
        image: comment.author.image,
        following: followingSet.has(comment.authorId),
      },
    }));
  }
}
