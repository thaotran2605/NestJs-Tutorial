import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { User } from '../../users/entities/user.entity.js';
import { UsersService } from '../../users/users.service.js';
import { JwtPayload, JwtStrategy } from './jwt.strategy.js';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let mockUsersService: {
    findById: ReturnType<typeof vi.fn>;
  };

  const sampleUser: User = {
    id: 1,
    username: 'jacob',
    email: 'jacob@example.com',
    password: 'hashed-password',
    bio: null,
    image: null,
    tokenVersion: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockUsersService = {
      findById: vi.fn().mockResolvedValue(sampleUser),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: vi.fn().mockReturnValue('test-secret-key'),
          },
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: I18nService,
          useValue: {
            t: vi.fn((key: string) => key),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should return user when tokenVersion matches', async () => {
    const payload: JwtPayload = {
      sub: 1,
      email: 'jacob@example.com',
      username: 'jacob',
      tokenVersion: 2,
      jti: 'jti-123',
    };

    const user = await strategy.validate(payload);
    expect(user).toEqual(sampleUser);
  });

  it('should throw UnauthorizedException when tokenVersion is outdated (other device token after password change)', async () => {
    const outdatedPayload: JwtPayload = {
      sub: 1,
      email: 'jacob@example.com',
      username: 'jacob',
      tokenVersion: 1,
      jti: 'old-jti',
    };

    await expect(strategy.validate(outdatedPayload)).rejects.toThrow(
      new UnauthorizedException('errors.AUTH_TOKEN_REVOKED'),
    );
  });

  it('should throw UnauthorizedException when user does not exist', async () => {
    mockUsersService.findById.mockResolvedValueOnce(null);

    const payload: JwtPayload = {
      sub: 999,
      email: 'ghost@example.com',
      username: 'ghost',
      tokenVersion: 1,
      jti: 'jti-ghost',
    };

    await expect(strategy.validate(payload)).rejects.toThrow(
      new UnauthorizedException('errors.AUTH_USER_INACTIVE'),
    );
  });
});
