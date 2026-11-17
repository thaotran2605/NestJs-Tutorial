import * as path from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule,
  QueryResolver,
} from 'nestjs-i18n';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { validateEnv } from './config/env.validation.js';
import { AttachmentsModule } from './modules/attachments/attachments.module.js';
import { Attachment } from './modules/attachments/entities/attachment.entity.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { Follow } from './modules/profiles/entities/follow.entity.js';
import { ProfilesModule } from './modules/profiles/profiles.module.js';
import { RedisModule } from './modules/redis/redis.module.js';
import { User } from './modules/users/entities/user.entity.js';
import { UsersModule } from './modules/users/users.module.js';

const DEFAULT_THROTTLE_TTL_MS = 60000;
const DEFAULT_THROTTLE_LIMIT = 30;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: DEFAULT_THROTTLE_TTL_MS,
        limit: DEFAULT_THROTTLE_LIMIT,
      },
    ]),
    RedisModule,
    AttachmentsModule,
    UsersModule,
    AuthModule,
    ProfilesModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.getOrThrow<string>('DB_HOST'),
        port: Number(config.getOrThrow<number>('DB_PORT')),
        username: config.getOrThrow<string>('DB_USERNAME'),
        password: config.getOrThrow<string>('DB_PASSWORD'),
        database: config.getOrThrow<string>('DB_DATABASE'),
        charset: 'utf8mb4_unicode_ci',
        entities: [User, Attachment, Follow],
        synchronize: false,
      }),
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: path.join(import.meta.dirname, 'i18n/'),
        watch: process.env.NODE_ENV !== 'production',
      },
      resolvers: [
        new QueryResolver(['lang', 'l']),
        new HeaderResolver(['x-custom-lang', 'accept-language']),
        AcceptLanguageResolver,
      ],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
