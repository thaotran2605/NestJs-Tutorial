import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { User } from '../users/entities/user.entity.js';
import { ArticlesService } from './articles.service.js';
import {
  ArticleResponseDto,
  MultipleArticlesResponseDto,
} from './dto/article-response.dto.js';
import { CreateArticleDto } from './dto/create-article.dto.js';
import {
  FeedArticlesQueryDto,
  ListArticlesQueryDto,
} from './dto/list-articles-query.dto.js';
import { UpdateArticleDto } from './dto/update-article.dto.js';

@ApiTags('Articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @ApiOperation({ summary: 'Create a new article' })
  @ApiResponse({
    status: 201,
    description: 'Article created successfully',
    type: ArticleResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createArticle(
    @Body() createArticleDto: CreateArticleDto,
    @CurrentUser() currentUser: User,
  ): Promise<ArticleResponseDto> {
    return this.articlesService.createArticle(
      createArticleDto.article,
      currentUser,
    );
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List articles globally with optional filters' })
  @ApiResponse({
    status: 200,
    description: 'Articles retrieved successfully',
    type: MultipleArticlesResponseDto,
  })
  async listArticles(
    @Query() query: ListArticlesQueryDto,
    @CurrentUser() currentUser?: User,
  ): Promise<MultipleArticlesResponseDto> {
    return this.articlesService.listArticles(query, currentUser);
  }

  // Must be declared before @Get(':slug') so "feed" is not parsed as a slug
  @Get('feed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @ApiOperation({ summary: 'Get recent articles from followed users' })
  @ApiResponse({
    status: 200,
    description: 'Feed articles retrieved successfully',
    type: MultipleArticlesResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFeed(
    @Query() query: FeedArticlesQueryDto,
    @CurrentUser() currentUser: User,
  ): Promise<MultipleArticlesResponseDto> {
    return this.articlesService.getFeed(query, currentUser);
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get a single article by slug' })
  @ApiParam({ name: 'slug', description: 'Unique slug of the article' })
  @ApiResponse({
    status: 200,
    description: 'Article retrieved successfully',
    type: ArticleResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async getArticle(
    @Param('slug') slug: string,
    @CurrentUser() currentUser?: User,
  ): Promise<ArticleResponseDto> {
    return this.articlesService.getArticleBySlug(slug, currentUser);
  }

  @Put(':slug')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @ApiOperation({ summary: 'Update an article (author only)' })
  @ApiParam({ name: 'slug', description: 'Unique slug of the article' })
  @ApiResponse({
    status: 200,
    description: 'Article updated successfully',
    type: ArticleResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden (not the author)' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async updateArticle(
    @Param('slug') slug: string,
    @Body() updateArticleDto: UpdateArticleDto,
    @CurrentUser() currentUser: User,
  ): Promise<ArticleResponseDto> {
    return this.articlesService.updateArticle(
      slug,
      updateArticleDto.article,
      currentUser,
    );
  }

  @Delete(':slug')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @ApiOperation({ summary: 'Delete an article (author only)' })
  @ApiParam({ name: 'slug', description: 'Unique slug of the article' })
  @ApiResponse({ status: 204, description: 'Article deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden (not the author)' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async deleteArticle(
    @Param('slug') slug: string,
    @CurrentUser() currentUser: User,
  ): Promise<void> {
    await this.articlesService.deleteArticle(slug, currentUser);
  }

  @Post(':slug/favorite')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @ApiOperation({ summary: 'Favorite an article' })
  @ApiParam({ name: 'slug', description: 'Unique slug of the article' })
  @ApiResponse({
    status: 200,
    description: 'Article favorited successfully',
    type: ArticleResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async favoriteArticle(
    @Param('slug') slug: string,
    @CurrentUser() currentUser: User,
  ): Promise<ArticleResponseDto> {
    return this.articlesService.favoriteArticle(slug, currentUser);
  }

  @Delete(':slug/favorite')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @ApiOperation({ summary: 'Unfavorite an article' })
  @ApiParam({ name: 'slug', description: 'Unique slug of the article' })
  @ApiResponse({
    status: 200,
    description: 'Article unfavorited successfully',
    type: ArticleResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async unfavoriteArticle(
    @Param('slug') slug: string,
    @CurrentUser() currentUser: User,
  ): Promise<ArticleResponseDto> {
    return this.articlesService.unfavoriteArticle(slug, currentUser);
  }
}
