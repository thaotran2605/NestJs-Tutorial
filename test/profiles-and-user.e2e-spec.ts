import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

describe('User Update, Avatar Upload & Profiles API (e2e)', () => {
  let app: INestApplication<App>;
  const uniqueSuffix = Date.now().toString();

  const userA = {
    username: `alice_${uniqueSuffix}`,
    email: `alice_${uniqueSuffix}@example.com`,
    password: 'Password123!',
  };
  const userB = {
    username: `bob_${uniqueSuffix}`,
    email: `bob_${uniqueSuffix}@example.com`,
    password: 'Password123!',
  };

  let tokenA: string;

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

    const configService = app.get(ConfigService);
    expect(configService.get('DB_DATABASE')).toBe('conduit_test');

    // Register User A and User B
    const resA = await request(app.getHttpServer())
      .post('/api/users')
      .send({ user: userA })
      .expect(201);
    tokenA = resA.body.user.token;

    await request(app.getHttpServer())
      .post('/api/users')
      .send({ user: userB })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('PUT /api/user (Update User & Upload Avatar)', () => {
    it('should update user bio via RealWorld JSON envelope', async () => {
      const response = await request(app.getHttpServer())
        .put('/api/user')
        .set('Authorization', `Token ${tokenA}`)
        .send({
          user: {
            bio: 'Fullstack NestJS Developer',
          },
        })
        .expect(200);

      expect(response.body.user.bio).toBe('Fullstack NestJS Developer');
      expect(response.body.user.username).toBe(userA.username);
    });

    it('should upload avatar file via multipart/form-data and create attachment', async () => {
      // Minimal valid 1x1 PNG buffer
      const pngBuffer = Buffer.from(
        '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
        'hex',
      );

      const response = await request(app.getHttpServer())
        .put('/api/user')
        .set('Authorization', `Token ${tokenA}`)
        .field('bio', 'Updated with avatar')
        .attach('avatar', pngBuffer, {
          filename: 'avatar.png',
          contentType: 'image/png',
        })
        .expect(200);

      expect(response.body.user.bio).toBe('Updated with avatar');
      expect(response.body.user.image).toMatch(
        /^\/uploads\/avatars\/[0-9a-f-]+\.png$/,
      );
    });
  });

  describe('Profiles & Follow/Unfollow (/api/profiles/:username)', () => {
    it('should get profile unauthenticated with following=false', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/profiles/${userB.username}`)
        .expect(200);

      expect(response.body.profile).toEqual({
        username: userB.username,
        bio: null,
        image: null,
        following: false,
      });
    });

    it('should follow userB and return following=true', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/profiles/${userB.username}/follow`)
        .set('Authorization', `Token ${tokenA}`)
        .expect(200);

      expect(response.body.profile.username).toBe(userB.username);
      expect(response.body.profile.following).toBe(true);
    });

    it('should show following=true when authenticated userA gets userB profile', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/profiles/${userB.username}`)
        .set('Authorization', `Token ${tokenA}`)
        .expect(200);

      expect(response.body.profile.following).toBe(true);
    });

    it('should unfollow userB and return following=false', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/profiles/${userB.username}/follow`)
        .set('Authorization', `Token ${tokenA}`)
        .expect(200);

      expect(response.body.profile.following).toBe(false);
    });

    it('should return 400 when attempting to follow oneself', async () => {
      await request(app.getHttpServer())
        .post(`/api/profiles/${userA.username}/follow`)
        .set('Authorization', `Token ${tokenA}`)
        .expect(400);
    });

    it('should return 404 when profile does not exist', async () => {
      await request(app.getHttpServer())
        .get('/api/profiles/non_existent_user_999999')
        .expect(404);
    });
  });
});
