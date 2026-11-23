import { Injectable, UnauthorizedException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { translateWithContext } from '../../common/utils/i18n.helper.js';
import { UsersService } from '../users/users.service.js';
import { LoginCredentialsDto } from './dto/login.dto.js';
import { CreateUserDto } from './dto/register.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { TokenService } from './token.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly i18n: I18nService,
  ) {}

  async register(dto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.usersService.createUser(dto);
    const token = await this.tokenService.generateToken(user);
    return this.tokenService.formatUserResponse(user, token);
  }

  async login(dto: LoginCredentialsDto): Promise<UserResponseDto> {
    const user = await this.usersService.validateCredentials(
      dto.email,
      dto.password,
    );

    if (!user) {
      throw new UnauthorizedException(
        translateWithContext(this.i18n, 'errors.AUTH_INVALID_CREDENTIALS'),
      );
    }

    const token = await this.tokenService.generateToken(user);
    return this.tokenService.formatUserResponse(user, token);
  }

  async logout(token: string | null): Promise<{ message: string }> {
    await this.tokenService.revokeToken(token);
    return {
      message: translateWithContext(this.i18n, 'common.LOGOUT_SUCCESS'),
    };
  }
}
