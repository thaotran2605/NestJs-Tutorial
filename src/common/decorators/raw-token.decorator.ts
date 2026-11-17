import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { extractJwtToken } from '../../modules/auth/strategies/jwt-extractor.js';

export const RawToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return extractJwtToken(request);
  },
);
