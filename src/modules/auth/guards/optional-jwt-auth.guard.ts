import { ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { I18nService } from 'nestjs-i18n';
import { RedisService } from '../../redis/redis.service.js';
import { extractJwtToken } from '../strategies/jwt-extractor.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  constructor(
    redisService: RedisService,
    jwtService: JwtService,
    i18n: I18nService,
  ) {
    super(redisService, jwtService, i18n);
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractJwtToken(request);

    if (!token) {
      return true;
    }

    return super.canActivate(context);
  }
}
