import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { User } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { Follow } from './entities/follow.entity.js';
import { ProfilesService } from './profiles.service.js';

describe('ProfilesService', () => {
  let service: ProfilesService;
  let mockFollowRepository: {
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockUsersService: {
    findByUsername: ReturnType<typeof vi.fn>;
  };

  const currentUser: User = {
    id: 1,
    username: 'jacob',
    email: 'jacob@example.com',
    password: 'hashed-password',
    bio: 'Follower bio',
    image: null,
    tokenVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const targetUser: User = {
    id: 2,
    username: 'celebrity',
    email: 'celebrity@example.com',
    password: 'hashed-password',
    bio: 'Famous author',
    image: '/uploads/avatars/celeb.png',
    tokenVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockFollowRepository = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((dto) => dto),
      save: vi.fn().mockImplementation((follow) => Promise.resolve(follow)),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
    };

    mockUsersService = {
      findByUsername: vi.fn().mockResolvedValue(targetUser),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        {
          provide: getRepositoryToken(Follow),
          useValue: mockFollowRepository,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: I18nService,
          useValue: { t: vi.fn((key: string) => key) },
        },
      ],
    }).compile();

    service = module.get<ProfilesService>(ProfilesService);
  });

  describe('getProfile', () => {
    it('should return profile with following=false when unauthenticated', async () => {
      const result = await service.getProfile('celebrity', null);

      expect(result).toEqual({
        profile: {
          username: 'celebrity',
          bio: 'Famous author',
          image: '/uploads/avatars/celeb.png',
          following: false,
        },
      });
      expect(mockFollowRepository.findOne).not.toHaveBeenCalled();
    });

    it('should return profile with following=true when currentUser follows targetUser', async () => {
      mockFollowRepository.findOne.mockResolvedValueOnce({
        followerId: 1,
        followingId: 2,
      });

      const result = await service.getProfile('celebrity', currentUser);

      expect(result.profile.following).toBe(true);
    });

    it('should throw NotFoundException if profile username does not exist', async () => {
      mockUsersService.findByUsername.mockResolvedValueOnce(null);

      await expect(service.getProfile('unknown', currentUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('followUser', () => {
    it('should create follow relationship and return following=true', async () => {
      const result = await service.followUser('celebrity', currentUser);

      expect(result.profile.following).toBe(true);
      expect(mockFollowRepository.save).toHaveBeenCalledWith({
        followerId: 1,
        followingId: 2,
      });
    });

    it('should handle MySQL ER_DUP_ENTRY race condition gracefully and return following=true', async () => {
      mockFollowRepository.save.mockRejectedValueOnce({
        code: 'ER_DUP_ENTRY',
        errno: 1062,
      });

      const result = await service.followUser('celebrity', currentUser);
      expect(result.profile.following).toBe(true);
    });

    it('should throw BadRequestException when trying to follow oneself', async () => {
      mockUsersService.findByUsername.mockResolvedValueOnce(currentUser);

      await expect(service.followUser('jacob', currentUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('unfollowUser', () => {
    it('should delete follow relationship and return following=false', async () => {
      const result = await service.unfollowUser('celebrity', currentUser);

      expect(result.profile.following).toBe(false);
      expect(mockFollowRepository.delete).toHaveBeenCalledWith({
        followerId: 1,
        followingId: 2,
      });
    });

    it('should throw BadRequestException when trying to unfollow oneself', async () => {
      mockUsersService.findByUsername.mockResolvedValueOnce(currentUser);

      await expect(service.unfollowUser('jacob', currentUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
