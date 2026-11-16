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
  USERNAME_MAX_LENGTH,
} from '../auth.constants.js';

export class CreateUserDto {
  @ApiProperty({ example: 'Jacob', description: 'Unique username' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(USERNAME_MAX_LENGTH)
  username: string;

  @ApiProperty({ example: 'jake@jake.jake', description: 'Unique email address' })
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'User password (between 8 and 72 bytes due to bcrypt limit)',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;
}

export class RegisterUserDto {
  @ApiProperty({ type: CreateUserDto })
  @ValidateNested()
  @Type(() => CreateUserDto)
  user: CreateUserDto;
}
