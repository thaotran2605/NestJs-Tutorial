import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
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
  trimString,
  trimStringArray,
} from '../../../common/utils/transform.util.js';
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

export class CreateArticleDataDto {
  @ApiProperty({ example: 'How to train your dragon' })
  @Transform(trimString)
  @IsNotEmpty()
  @IsString()
  @MinLength(ARTICLE_TITLE_MIN_LENGTH)
  @MaxLength(ARTICLE_TITLE_MAX_LENGTH)
  title: string;

  @ApiProperty({ example: 'Ever wonder how?' })
  @Transform(trimString)
  @IsNotEmpty()
  @IsString()
  @MinLength(ARTICLE_DESCRIPTION_MIN_LENGTH)
  @MaxLength(ARTICLE_DESCRIPTION_MAX_LENGTH)
  description: string;

  @ApiProperty({ example: 'You have to believe' })
  @Transform(trimString)
  @IsNotEmpty()
  @IsString()
  @MinLength(ARTICLE_BODY_MIN_LENGTH)
  @MaxLength(ARTICLE_BODY_MAX_LENGTH)
  body: string;

  @ApiPropertyOptional({
    example: ['reactjs', 'angularjs', 'dragons'],
    type: [String],
  })
  @IsOptional()
  @Transform(trimStringArray)
  @IsArray()
  @ArrayMaxSize(ARTICLE_MAX_TAGS)
  @IsString({ each: true })
  @MinLength(TAG_NAME_MIN_LENGTH, { each: true })
  @MaxLength(TAG_NAME_MAX_LENGTH, { each: true })
  tagList?: string[];
}

export class CreateArticleDto {
  @ApiProperty({ type: CreateArticleDataDto })
  @IsDefined()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => CreateArticleDataDto)
  article: CreateArticleDataDto;
}
