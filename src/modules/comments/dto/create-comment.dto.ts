import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsNotEmptyObject,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  COMMENT_BODY_MAX_LENGTH,
  COMMENT_BODY_MIN_LENGTH,
} from '../comments.constants.js';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCommentDataDto {
  @ApiProperty({ example: 'His name was my name too.' })
  @Transform(trimString)
  @IsNotEmpty()
  @IsString()
  @MinLength(COMMENT_BODY_MIN_LENGTH)
  @MaxLength(COMMENT_BODY_MAX_LENGTH)
  body: string;
}

export class CreateCommentDto {
  @ApiProperty({ type: CreateCommentDataDto })
  @IsDefined()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => CreateCommentDataDto)
  comment: CreateCommentDataDto;
}
