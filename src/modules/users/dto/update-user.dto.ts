import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  BIO_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  IMAGE_URL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from '../../auth/auth.constants.js';

export class UpdateUserDataDto {
  @ApiPropertyOptional({
    example: 'jacob_new@example.com',
    description: 'Updated unique email address',
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email?: string;

  @ApiPropertyOptional({
    example: 'jacob_new',
    description: 'Updated unique username',
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @MinLength(USERNAME_MIN_LENGTH)
  @MaxLength(USERNAME_MAX_LENGTH)
  username?: string;

  @ApiPropertyOptional({
    example: 'NewPassword123!',
    description: 'Updated user password (8 to 72 bytes)',
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password?: string;

  @ApiPropertyOptional({
    example: 'I work at statefarm',
    description: 'User biography',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(BIO_MAX_LENGTH)
  bio?: string | null;

  @ApiPropertyOptional({
    example: '/uploads/avatars/sample.png',
    description: 'Avatar image URL (if not uploading a file)',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @MaxLength(IMAGE_URL_MAX_LENGTH)
  image?: string | null;
}

export class UpdateUserDto extends UpdateUserDataDto {
  @ApiPropertyOptional({
    type: UpdateUserDataDto,
    description: 'RealWorld JSON envelope { user: { ... } }',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateUserDataDto)
  user?: UpdateUserDataDto;
}
