import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { I18nService } from 'nestjs-i18n';
import { Strategy } from 'passport-jwt';
import { translateWithContext } from '../../../common/utils/i18n.helper.js';
import { UsersService } from '../../users/users.service.js';
import { extractJwtToken } from './jwt-extractor.js';

export interface JwtPayload {
  sub: number;
  email: string;
  username: string;
  tokenVersion: number;
  jti: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly i18n: I18nService,
  ) {
    super({
      jwtFromRequest: extractJwtToken,
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException(
        translateWithContext(this.i18n, 'errors.AUTH_USER_INACTIVE'),
      );
    }

    if (payload.tokenVersion !== user.tokenVersion) {
      throw new UnauthorizedException(
        translateWithContext(this.i18n, 'errors.AUTH_TOKEN_REVOKED'),
      );
    }

    return user;
  }
}
