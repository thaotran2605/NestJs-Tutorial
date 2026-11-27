import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter.js';
import {
  TEST_DATABASE_NAME,
  assertTestDatabase,
} from './database.helper.js';

export interface TestAppContext {
  app: INestApplication<App>;
  dataSource: DataSource;
}

/**
 * Bootstraps the NestJS application for E2E testing with the same global prefix,
 * exception filter, and validation pipe as production, while asserting the
 * connection targets the isolated `conduit_test` database.
 */
export async function createTestApp(): Promise<TestAppContext> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  const configService = app.get(ConfigService);
  const configuredDb = configService.get<string>('DB_DATABASE');
  if (configuredDb !== TEST_DATABASE_NAME) {
    await app.close();
    throw new Error(
      `Expected DB_DATABASE="${TEST_DATABASE_NAME}" in E2E tests, got "${String(configuredDb)}".`,
    );
  }

  const dataSource = app.get(DataSource);
  assertTestDatabase(dataSource);

  return { app, dataSource };
}
