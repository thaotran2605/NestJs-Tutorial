import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

describe('Auth & User API (e2e)', () => {
  let app: INestApplication<App>;
  const uniqueSuffix = Date.now().toString();
  const testEmail = `testuser_${uniqueSuffix}@example.com`;
  const testUsername = `user_${uniqueSuffix}`;
  const testPassword = 'Password123!';
  let jwtToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/users (Register)', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/users')
        .send({
          user: {
            username: testUsername,
            email: testEmail,
            password: testPassword,
          },
        })
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', testEmail);
      expect(response.body.user).toHaveProperty('username', testUsername);
      expect(response.body.user).toHaveProperty('token');
      expect(typeof response.body.user.token).toBe('string');
      jwtToken = response.body.user.token;
    });

    it('should return 409 when registering with existing email', async () => {
      await request(app.getHttpServer())
        .post('/api/users')
        .send({
          user: {
            username: `diff_${uniqueSuffix}`,
            email: testEmail,
            password: testPassword,
          },
        })
        .expect(409);
    });
  });

  describe('POST /api/users/login (Login)', () => {
    it('should login successfully with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/users/login')
        .send({
          user: {
            email: testEmail,
            password: testPassword,
          },
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testEmail);
      expect(response.body.user.token).toBeDefined();
      jwtToken = response.body.user.token;
    });

    it('should return 401 with invalid password', async () => {
      await request(app.getHttpServer())
        .post('/api/users/login')
        .send({
          user: {
            email: testEmail,
            password: 'WrongPassword!',
          },
        })
        .expect(401);
    });
  });

  describe('GET /api/user (Get Current User)', () => {
    it('should get current user with valid Bearer token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/user')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(response.body.user.email).toBe(testEmail);
      expect(response.body.user.username).toBe(testUsername);
    });

    it('should get current user with valid Token scheme (RealWorld spec)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/user')
        .set('Authorization', `Token ${jwtToken}`)
        .expect(200);

      expect(response.body.user.email).toBe(testEmail);
    });

    it('should return 401 without authorization header', async () => {
      await request(app.getHttpServer()).get('/api/user').expect(401);
    });
  });

  describe('POST /api/users/logout (Logout & Redis Blacklist)', () => {
    it('should logout and invalidate current token in Redis', async () => {
      await request(app.getHttpServer())
        .post('/api/users/logout')
        .set('Authorization', `Token ${jwtToken}`)
        .expect(200);
    });

    it('should reject requests using the revoked token', async () => {
      await request(app.getHttpServer())
        .get('/api/user')
        .set('Authorization', `Token ${jwtToken}`)
        .expect(401);
    });
  });
});
