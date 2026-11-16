import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../auth.constants.js';

export class LoginCredentialsDto {
  @ApiProperty({ example: 'jake@jake.jake', description: 'User email address' })
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'User password (max 72 bytes due to bcrypt limit)',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;
}

export class LoginUserDto {
  @ApiProperty({ type: LoginCredentialsDto })
  @ValidateNested()
  @Type(() => LoginCredentialsDto)
  user: LoginCredentialsDto;
}
