import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis as RedisClient } from 'ioredis';
import {
  DEFAULT_REDIS_HOST,
  DEFAULT_REDIS_PORT,
  REDIS_CLIENT,
} from './redis.constants.js';
import { RedisService } from './redis.service.js';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return new RedisClient({
          host: configService.get<string>('REDIS_HOST', DEFAULT_REDIS_HOST),
          port: Number(
            configService.get<number>('REDIS_PORT', DEFAULT_REDIS_PORT),
          ),
          lazyConnect: false,
        });
      },
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
