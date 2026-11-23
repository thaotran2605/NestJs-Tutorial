import {
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { I18nService } from 'nestjs-i18n';
import { translateWithContext } from '../../../common/utils/i18n.helper.js';
import { RedisService } from '../../redis/redis.service.js';
import { extractJwtToken } from '../strategies/jwt-extractor.js';
import { JwtPayload } from '../strategies/jwt.strategy.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    private readonly i18n: I18nService,
  ) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractJwtToken(request);

    if (token) {
      try {
        const decoded = this.jwtService.decode(token) as JwtPayload | null;
        if (decoded?.jti) {
          const isBlacklisted =
            await this.redisService.isTokenBlacklisted(decoded.jti);
          if (isBlacklisted) {
            throw new UnauthorizedException(
              translateWithContext(this.i18n, 'errors.AUTH_TOKEN_REVOKED'),
            );
          }
        }
      } catch (error) {
        if (error instanceof UnauthorizedException) {
          throw error;
        }
        Logger.error(
          {
            message:
              'Redis blacklist check failed - failing closed for security',
            error: error instanceof Error ? error.message : String(error),
          },
          JwtAuthGuard.name,
        );
        throw new ServiceUnavailableException(
          translateWithContext(this.i18n, 'errors.AUTH_SERVICE_UNAVAILABLE'),
        );
      }
    }

    const canActivateResult = await super.canActivate(context);
    return canActivateResult as boolean;
  }
}
