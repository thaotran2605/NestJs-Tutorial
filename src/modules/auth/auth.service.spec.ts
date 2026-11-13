import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../redis/redis.service.js';
import { User } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let authService: AuthService;
  let mockUsersService: {
    createUser: ReturnType<typeof vi.fn>;
    validateCredentials: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
  };
  let mockJwtService: {
    signAsync: ReturnType<typeof vi.fn>;
    decode: ReturnType<typeof vi.fn>;
  };
  let mockRedisService: {
    addTokenToBlacklist: ReturnType<typeof vi.fn>;
    isTokenBlacklisted: ReturnType<typeof vi.fn>;
  };

  const sampleUser: User = {
    id: 1,
    username: 'jacob',
    email: 'jacob@example.com',
    password: 'hashed-password',
    bio: 'Software Engineer',
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockUsersService = {
      createUser: vi.fn().mockResolvedValue(sampleUser),
      validateCredentials: vi.fn().mockResolvedValue(sampleUser),
      findById: vi.fn().mockResolvedValue(sampleUser),
    };

    mockJwtService = {
      signAsync: vi.fn().mockResolvedValue('sample-jwt-token'),
      decode: vi.fn().mockReturnValue({
        sub: 1,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    };

    mockRedisService = {
      addTokenToBlacklist: vi.fn().mockResolvedValue(undefined),
      isTokenBlacklisted: vi.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should register a user and return response with token', async () => {
      const result = await authService.register({
        username: 'jacob',
        email: 'jacob@example.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe('jacob@example.com');
      expect(result.user.token).toBe('sample-jwt-token');
      expect(mockUsersService.createUser).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should authenticate user and return token', async () => {
      const result = await authService.login({
        email: 'jacob@example.com',
        password: 'password123',
      });

      expect(result.user.username).toBe('jacob');
      expect(result.user.token).toBe('sample-jwt-token');
    });

    it('should throw UnauthorizedException if credentials invalid', async () => {
      mockUsersService.validateCredentials.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'wrong@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should add token to redis blacklist with remaining ttl', async () => {
      const result = await authService.logout('sample-token');
      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(mockRedisService.addTokenToBlacklist).toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user with token', () => {
      const result = authService.getCurrentUser(sampleUser, 'current-token');
      expect(result.user.username).toBe('jacob');
      expect(result.user.token).toBe('current-token');
    });
  });
});
