import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { USERNAME_MAX_LENGTH } from '../../auth/auth.constants.js';
import {
  DEFAULT_ARTICLES_LIMIT,
  DEFAULT_ARTICLES_OFFSET,
  MAX_ARTICLES_LIMIT,
  MIN_ARTICLES_LIMIT,
  MIN_ARTICLES_OFFSET,
  TAG_NAME_MAX_LENGTH,
} from '../articles.constants.js';

export class FeedArticlesQueryDto {
  @ApiPropertyOptional({
    example: DEFAULT_ARTICLES_LIMIT,
    default: DEFAULT_ARTICLES_LIMIT,
    minimum: MIN_ARTICLES_LIMIT,
    maximum: MAX_ARTICLES_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_ARTICLES_LIMIT)
  @Max(MAX_ARTICLES_LIMIT)
  limit?: number = DEFAULT_ARTICLES_LIMIT;

  @ApiPropertyOptional({
    example: DEFAULT_ARTICLES_OFFSET,
    default: DEFAULT_ARTICLES_OFFSET,
    minimum: MIN_ARTICLES_OFFSET,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_ARTICLES_OFFSET)
  offset?: number = DEFAULT_ARTICLES_OFFSET;
}

export class ListArticlesQueryDto extends FeedArticlesQueryDto {
  @ApiPropertyOptional({ example: 'reactjs', description: 'Filter by tag name' })
  @IsOptional()
  @IsString()
  @MaxLength(TAG_NAME_MAX_LENGTH)
  tag?: string;

  @ApiPropertyOptional({
    example: 'jacob',
    description: 'Filter by author username',
  })
  @IsOptional()
  @IsString()
  @MaxLength(USERNAME_MAX_LENGTH)
  author?: string;

  @ApiPropertyOptional({
    example: 'jane',
    description: 'Filter by articles favorited by username',
  })
  @IsOptional()
  @IsString()
  @MaxLength(USERNAME_MAX_LENGTH)
  favorited?: string;
}
