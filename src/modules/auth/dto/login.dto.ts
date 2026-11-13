import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class LoginCredentialsDto {
  @ApiProperty({ example: 'jake@jake.jake', description: 'User email address' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', description: 'User password' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(128)
  password: string;
}

export class LoginUserDto {
  @ApiProperty({ type: LoginCredentialsDto })
  @ValidateNested()
  @Type(() => LoginCredentialsDto)
  user: LoginCredentialsDto;
}
