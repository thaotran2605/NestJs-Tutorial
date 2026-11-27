import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { INITIAL_TOKEN_VERSION } from '../../src/modules/auth/auth.constants.js';
import { TokenService } from '../../src/modules/auth/token.service.js';
import { User } from '../../src/modules/users/entities/user.entity.js';

const DEFAULT_PLAIN_PASSWORD = 'Password123!';
const FAST_TEST_BCRYPT_ROUNDS = 4;

let cachedDefaultPasswordHash: string | null = null;

async function getHashedPassword(plainPassword?: string): Promise<string> {
  if (!plainPassword || plainPassword === DEFAULT_PLAIN_PASSWORD) {
    if (!cachedDefaultPasswordHash) {
      cachedDefaultPasswordHash = await bcrypt.hash(
        DEFAULT_PLAIN_PASSWORD,
        FAST_TEST_BCRYPT_ROUNDS,
      );
    }
    return cachedDefaultPasswordHash;
  }

  return bcrypt.hash(plainPassword, FAST_TEST_BCRYPT_ROUNDS);
}

export interface FakeUserOverrides {
  username?: string;
  email?: string;
  password?: string;
  bio?: string | null;
  image?: string | null;
  tokenVersion?: number;
}

export interface AuthenticatedFakeUser {
  user: User;
  token: string;
}

export async function createFakeUser(
  dataSource: DataSource,
  overrides: FakeUserOverrides = {},
): Promise<User> {
  const userRepository = dataSource.getRepository(User);
  const uniqueTag = faker.string.alphanumeric({ length: 8, casing: 'lower' });
  const baseUsername = faker.internet
    .username()
    .replaceAll(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 20);

  const hashedPassword = await getHashedPassword(overrides.password);

  const user = userRepository.create({
    username: overrides.username ?? `${baseUsername || 'user'}_${uniqueTag}`,
    email:
      overrides.email ??
      `${(baseUsername || 'user').toLowerCase()}_${uniqueTag}@example.com`,
    password: hashedPassword,
    bio: overrides.bio !== undefined ? overrides.bio : faker.lorem.sentence(),
    image:
      overrides.image !== undefined
        ? overrides.image
        : `https://api.realworld.io/images/${uniqueTag}.jpg`,
    tokenVersion: overrides.tokenVersion ?? INITIAL_TOKEN_VERSION,
  });

  return userRepository.save(user);
}

export async function createAuthenticatedFakeUser(
  app: INestApplication<App>,
  dataSource: DataSource,
  overrides: FakeUserOverrides = {},
): Promise<AuthenticatedFakeUser> {
  const user = await createFakeUser(dataSource, overrides);
  const tokenService = app.get(TokenService);
  const token = await tokenService.generateToken(user);

  return { user, token };
}
