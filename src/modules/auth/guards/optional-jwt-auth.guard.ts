import { ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { extractJwtToken } from '../strategies/jwt-extractor.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractJwtToken(request);

    if (!token) {
      return true;
    }

    return super.canActivate(context);
  }
}
