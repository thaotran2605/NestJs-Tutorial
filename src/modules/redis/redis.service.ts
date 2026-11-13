import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import {
  BLACKLIST_PREFIX,
  REDIS_CLIENT,
} from './redis.constants.js';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds && ttlSeconds > 0) {
      await this.redisClient.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.redisClient.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.redisClient.get(key);
  }

  async deleteKey(key: string): Promise<number> {
    return this.redisClient.del(key);
  }

  async addTokenToBlacklist(token: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) {
      return;
    }
    const key = `${BLACKLIST_PREFIX}${token}`;
    await this.set(key, 'revoked', ttlSeconds);
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const key = `${BLACKLIST_PREFIX}${token}`;
    const result = await this.get(key);
    return result !== null;
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redisClient.quit();
    } catch (error) {
      Logger.error(
        {
          message: 'Error closing Redis connection',
          error: error instanceof Error ? error.message : String(error),
        },
        RedisService.name,
      );
    }
  }
}
