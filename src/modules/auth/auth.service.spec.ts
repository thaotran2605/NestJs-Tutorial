import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { User } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { TokenService } from './token.service.js';

describe('AuthService', () => {
  let authService: AuthService;
  let mockUsersService: {
    createUser: ReturnType<typeof vi.fn>;
    validateCredentials: ReturnType<typeof vi.fn>;
  };
  let mockTokenService: {
    generateToken: ReturnType<typeof vi.fn>;
    revokeToken: ReturnType<typeof vi.fn>;
    formatUserResponse: ReturnType<typeof vi.fn>;
  };
  let mockI18nService: {
    t: ReturnType<typeof vi.fn>;
  };

  const sampleUser: User = {
    id: 1,
    username: 'jacob',
    email: 'jacob@example.com',
    password: 'hashed-password',
    bio: 'Software Engineer',
    image: null,
    tokenVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockUsersService = {
      createUser: vi.fn().mockResolvedValue(sampleUser),
      validateCredentials: vi.fn().mockResolvedValue(sampleUser),
    };

    mockTokenService = {
      generateToken: vi.fn().mockResolvedValue('sample-jwt-token'),
      revokeToken: vi.fn().mockResolvedValue(undefined),
      formatUserResponse: vi.fn().mockImplementation((user: User, token: string) => ({
        user: {
          email: user.email,
          token,
          username: user.username,
          bio: user.bio,
          image: user.image,
        },
      })),
    };

    mockI18nService = {
      t: vi.fn((key: string) => key),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: TokenService, useValue: mockTokenService },
        { provide: I18nService, useValue: mockI18nService },
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
      expect(mockTokenService.generateToken).toHaveBeenCalledWith(sampleUser);
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

    it('should throw localized UnauthorizedException if credentials invalid', async () => {
      mockUsersService.validateCredentials.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'wrong@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(
        new UnauthorizedException('errors.AUTH_INVALID_CREDENTIALS'),
      );
    });
  });

  describe('logout', () => {
    it('should revoke token via TokenService and return localized message', async () => {
      const result = await authService.logout('sample-token');
      expect(result).toEqual({ message: 'common.LOGOUT_SUCCESS' });
      expect(mockTokenService.revokeToken).toHaveBeenCalledWith('sample-token');
    });
  });
});
