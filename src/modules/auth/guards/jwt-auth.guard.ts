import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { RedisService } from '../../redis/redis.service.js';
import {
  AUTH_HEADER_BEARER_SCHEME,
  AUTH_HEADER_TOKEN_SCHEME,
} from '../auth.constants.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly redisService: RedisService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers?.authorization;

    if (authHeader && typeof authHeader === 'string') {
      const [scheme, token] = authHeader.split(' ');
      if (
        (scheme === AUTH_HEADER_TOKEN_SCHEME ||
          scheme === AUTH_HEADER_BEARER_SCHEME) &&
        token
      ) {
        const isBlacklisted =
          await this.redisService.isTokenBlacklisted(token);
        if (isBlacklisted) {
          throw new UnauthorizedException('Token has been revoked');
        }
      }
    }

    const canActivateResult = await super.canActivate(context);
    return canActivateResult as boolean;
  }
}
