import { Request } from 'express';
import {
  AUTH_HEADER_BEARER_SCHEME,
  AUTH_HEADER_TOKEN_SCHEME,
} from '../auth.constants.js';

export function extractJwtToken(request: Request): string | null {
  const authHeader = request?.headers?.authorization;
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
}
