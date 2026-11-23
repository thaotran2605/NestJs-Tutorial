import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../redis/redis.service.js';
import { User } from '../users/entities/user.entity.js';
import { TokenService } from './token.service.js';

describe('TokenService', () => {
  let tokenService: TokenService;
  let mockJwtService: {
    signAsync: ReturnType<typeof vi.fn>;
    decode: ReturnType<typeof vi.fn>;
  };
  let mockRedisService: {
    addTokenToBlacklist: ReturnType<typeof vi.fn>;
  };

  const sampleUser: User = {
    id: 1,
    username: 'jacob',
    email: 'jacob@example.com',
    password: 'hashed-password',
    bio: 'Bio',
    image: null,
    tokenVersion: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockJwtService = {
      signAsync: vi.fn().mockResolvedValue('signed-jwt'),
      decode: vi.fn().mockReturnValue({
        sub: 1,
        jti: 'jti-123',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    };

    mockRedisService = {
      addTokenToBlacklist: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    tokenService = module.get<TokenService>(TokenService);
  });

  it('should embed user tokenVersion and jti in signed JWT payload', async () => {
    const token = await tokenService.generateToken(sampleUser);

    expect(token).toBe('signed-jwt');
    expect(mockJwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 1,
        email: 'jacob@example.com',
        username: 'jacob',
        tokenVersion: 3,
        jti: expect.any(String),
      }),
    );
  });

  it('should add token jti to redis blacklist with remaining TTL', async () => {
    await tokenService.revokeToken('sample-token');

    expect(mockRedisService.addTokenToBlacklist).toHaveBeenCalledWith(
      'jti-123',
      expect.any(Number),
    );
  });
});
