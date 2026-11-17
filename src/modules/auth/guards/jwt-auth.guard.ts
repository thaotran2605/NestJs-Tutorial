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
import { RedisService } from '../../redis/redis.service.js';
import { extractJwtToken } from '../strategies/jwt-extractor.js';
import { JwtPayload } from '../strategies/jwt.strategy.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractJwtToken(request);

    if (token) {
      try {
        const decoded = this.jwtService.decode(token) as JwtPayload | null;
        if (decoded?.jti) {
          const isBlacklisted =
            await this.redisService.isTokenBlacklisted(decoded.jti);
          if (isBlacklisted) {
            throw new UnauthorizedException('Token has been revoked');
          }
        }
      } catch (error) {
        if (error instanceof UnauthorizedException) {
          throw error;
        }
        Logger.error(
          {
            message: 'Redis blacklist check failed - failing closed for security',
            error: error instanceof Error ? error.message : String(error),
          },
          JwtAuthGuard.name,
        );
        throw new ServiceUnavailableException(
          'Authentication service temporarily unavailable',
        );
      }
    }

    const canActivateResult = await super.canActivate(context);
    return canActivateResult as boolean;
  }
}
