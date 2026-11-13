import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import {
  AUTH_HEADER_BEARER_SCHEME,
  AUTH_HEADER_TOKEN_SCHEME,
} from '../../modules/auth/auth.constants.js';

export const RawToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;

    if (!authHeader || typeof authHeader !== 'string') {
      return null;
    }

    const [scheme, token] = authHeader.split(' ');
    if (
      (scheme === AUTH_HEADER_TOKEN_SCHEME ||
        scheme === AUTH_HEADER_BEARER_SCHEME) &&
      token
    ) {
      return token;
    }

    return null;
  },
);
