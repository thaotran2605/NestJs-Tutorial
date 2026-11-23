import * as fs from 'node:fs';
import * as path from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { PUBLIC_DIR_NAME } from '../src/modules/attachments/attachments.constants.js';

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
  let uploadedAvatarUrl: string;

  // Minimal valid 1x1 PNG buffer
  const validPngBuffer = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
    'hex',
  );

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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
    if (uploadedAvatarUrl) {
      const filePath = path.join(
        process.cwd(),
        PUBLIC_DIR_NAME,
        uploadedAvatarUrl,
      );
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
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

    it('should reject javascript:alert(1) in image URL field (XSS prevention) with localized message', async () => {
      const resEn = await request(app.getHttpServer())
        .put('/api/user')
        .set('Authorization', `Token ${tokenA}`)
        .send({
          user: {
            image: 'javascript:alert(1)',
          },
        })
        .expect(400);

      expect(resEn.body.errors.body[0]).toContain(
        'Image must be a valid http(s) URL or /uploads/avatars/ path',
      );

      const resVi = await request(app.getHttpServer())
        .put('/api/user?lang=vi')
        .set('Authorization', `Token ${tokenA}`)
        .send({
          user: {
            image: 'javascript:alert(1)',
          },
        })
        .expect(400);

      expect(resVi.body.errors.body[0]).toContain(
        'Đường dẫn ảnh phải là URL http(s) hợp lệ hoặc đường dẫn /uploads/avatars/',
      );
    });

    it('should upload avatar file via multipart/form-data and create attachment', async () => {
      const response = await request(app.getHttpServer())
        .put('/api/user')
        .set('Authorization', `Token ${tokenA}`)
        .field('bio', 'Updated with avatar')
        .attach('avatar', validPngBuffer, {
          filename: 'avatar.png',
          contentType: 'image/png',
        })
        .expect(200);

      expect(response.body.user.bio).toBe('Updated with avatar');
      expect(response.body.user.image).toMatch(
        /^\/uploads\/avatars\/[0-9a-f-]+\.png$/,
      );

      uploadedAvatarUrl = response.body.user.image;
      const diskPath = path.join(
        process.cwd(),
        PUBLIC_DIR_NAME,
        uploadedAvatarUrl,
      );
      expect(fs.existsSync(diskPath)).toBe(true);
    });

    it('should keep old avatar intact if user update fails (e.g. duplicate username)', async () => {
      const avatarDir = path.join(
        process.cwd(),
        PUBLIC_DIR_NAME,
        'uploads',
        'avatars',
      );
      const filesBefore = fs.readdirSync(avatarDir);

      const errorRes = await request(app.getHttpServer())
        .put('/api/user?lang=vi')
        .set('Authorization', `Token ${tokenA}`)
        .field('username', userB.username)
        .attach('avatar', validPngBuffer, {
          filename: 'new-avatar.png',
          contentType: 'image/png',
        })
        .expect(409);

      expect(errorRes.body.errors.body).toEqual(['Tên người dùng đã được sử dụng']);

      const currentUserRes = await request(app.getHttpServer())
        .get('/api/user')
        .set('Authorization', `Token ${tokenA}`)
        .expect(200);

      expect(currentUserRes.body.user.image).toBe(uploadedAvatarUrl);
      const filesAfter = fs.readdirSync(avatarDir);
      expect(filesAfter).toEqual(filesBefore);
    });

    it('should revoke ALL active sessions (including other devices) when password changes', async () => {
      // Simulate second login session from another device
      const loginRes = await request(app.getHttpServer())
        .post('/api/users/login')
        .send({
          user: {
            email: userA.email,
            password: userA.password,
          },
        })
        .expect(200);
      const otherDeviceToken = loginRes.body.user.token;

      // Change password from session A (tokenA)
      const updateRes = await request(app.getHttpServer())
        .put('/api/user')
        .set('Authorization', `Token ${tokenA}`)
        .send({
          user: {
            password: 'NewPassword456!',
          },
        })
        .expect(200);

      const newTokenA = updateRes.body.user.token;
      expect(newTokenA).toBeDefined();
      expect(newTokenA).not.toBe(tokenA);

      // Old tokenA must be rejected
      await request(app.getHttpServer())
        .get('/api/user')
        .set('Authorization', `Token ${tokenA}`)
        .expect(401);

      // Other device token issued BEFORE password change must ALSO be rejected
      await request(app.getHttpServer())
        .get('/api/user')
        .set('Authorization', `Token ${otherDeviceToken}`)
        .expect(401);

      // New token returned after password change must succeed
      await request(app.getHttpServer())
        .get('/api/user')
        .set('Authorization', `Token ${newTokenA}`)
        .expect(200);

      tokenA = newTokenA;
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

    it('should return localized 400 when attempting to follow oneself', async () => {
      const resVi = await request(app.getHttpServer())
        .post(`/api/profiles/${userA.username}/follow?lang=vi`)
        .set('Authorization', `Token ${tokenA}`)
        .expect(400);

      expect(resVi.body.errors.body).toEqual([
        'Bạn không thể tự theo dõi chính mình',
      ]);
    });

    it('should return localized 404 when profile does not exist', async () => {
      const resVi = await request(app.getHttpServer())
        .get('/api/profiles/non_existent_user_999999?lang=vi')
        .expect(404);

      expect(resVi.body.errors.body).toEqual([
        'Không tìm thấy hồ sơ người dùng',
      ]);
    });
  });
});
