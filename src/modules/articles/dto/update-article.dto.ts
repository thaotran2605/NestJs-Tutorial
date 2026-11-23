import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsNotEmpty,
  IsNotEmptyObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  ARTICLE_BODY_MAX_LENGTH,
  ARTICLE_BODY_MIN_LENGTH,
  ARTICLE_DESCRIPTION_MAX_LENGTH,
  ARTICLE_DESCRIPTION_MIN_LENGTH,
  ARTICLE_MAX_TAGS,
  ARTICLE_TITLE_MAX_LENGTH,
  ARTICLE_TITLE_MIN_LENGTH,
  TAG_NAME_MAX_LENGTH,
  TAG_NAME_MIN_LENGTH,
} from '../articles.constants.js';

export class UpdateArticleDataDto {
  @ApiPropertyOptional({ example: 'Did you train your dragon?' })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MinLength(ARTICLE_TITLE_MIN_LENGTH)
  @MaxLength(ARTICLE_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MinLength(ARTICLE_DESCRIPTION_MIN_LENGTH)
  @MaxLength(ARTICLE_DESCRIPTION_MAX_LENGTH)
  description?: string;

  @ApiPropertyOptional({ example: 'Updated body content' })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MinLength(ARTICLE_BODY_MIN_LENGTH)
  @MaxLength(ARTICLE_BODY_MAX_LENGTH)
  body?: string;

  @ApiPropertyOptional({
    example: ['nestjs', 'typeorm'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(ARTICLE_MAX_TAGS)
  @IsString({ each: true })
  @MinLength(TAG_NAME_MIN_LENGTH, { each: true })
  @MaxLength(TAG_NAME_MAX_LENGTH, { each: true })
  tagList?: string[];
}

export class UpdateArticleDto {
  @ApiProperty({ type: UpdateArticleDataDto })
  @IsDefined()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => UpdateArticleDataDto)
  article: UpdateArticleDataDto;
}
