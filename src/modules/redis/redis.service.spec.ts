import { Test, TestingModule } from '@nestjs/testing';
import { REDIS_CLIENT } from './redis.constants.js';
import { RedisService } from './redis.service.js';

describe('RedisService', () => {
  let service: RedisService;
  let mockRedisClient: {
    set: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    quit: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockRedisClient = {
      set: vi.fn().mockResolvedValue('OK'),
      get: vi.fn().mockResolvedValue(null),
      del: vi.fn().mockResolvedValue(1),
      quit: vi.fn().mockResolvedValue('OK'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: REDIS_CLIENT,
          useValue: mockRedisClient,
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addTokenToBlacklist', () => {
    it('should set key in redis with expiration', async () => {
      await service.addTokenToBlacklist('sample-token', 3600);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'bl:sample-token',
        'revoked',
        'EX',
        3600,
      );
    });

    it('should ignore if ttl is <= 0', async () => {
      await service.addTokenToBlacklist('sample-token', 0);
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return true if token is found', async () => {
      mockRedisClient.get.mockResolvedValue('revoked');
      const isBlacklisted = await service.isTokenBlacklisted('sample-token');
      expect(isBlacklisted).toBe(true);
      expect(mockRedisClient.get).toHaveBeenCalledWith('bl:sample-token');
    });

    it('should return false if token is not found', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      const isBlacklisted = await service.isTokenBlacklisted('valid-token');
      expect(isBlacklisted).toBe(false);
    });
  });
});
