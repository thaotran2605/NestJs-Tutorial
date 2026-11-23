import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service.js';
import { User } from '../users/entities/user.entity.js';
import { INITIAL_TOKEN_VERSION } from './auth.constants.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { JwtPayload } from './strategies/jwt.strategy.js';

const MS_PER_SECOND = 1000;

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async generateToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      tokenVersion: user.tokenVersion ?? INITIAL_TOKEN_VERSION,
      jti: randomUUID(),
    };
    return this.jwtService.signAsync(payload);
  }

  async revokeToken(token: string | null): Promise<void> {
    if (!token) {
      return;
    }

    const decoded = this.jwtService.decode(token) as JwtPayload | null;
    if (decoded && decoded.jti && decoded.exp) {
      const currentTime = Math.floor(Date.now() / MS_PER_SECOND);
      const remainingSeconds = decoded.exp - currentTime;
      if (remainingSeconds > 0) {
        await this.redisService.addTokenToBlacklist(
          decoded.jti,
          remainingSeconds,
        );
      }
    }
  }

  formatUserResponse(user: User, token: string): UserResponseDto {
    return {
      user: {
        email: user.email,
        token,
        username: user.username,
        bio: user.bio,
        image: user.image,
      },
    };
  }
}
