import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { AttachmentsService } from '../attachments/attachments.service.js';
import { User } from './entities/user.entity.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;
  let mockRepository: {
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let mockAttachmentsService: {
    saveEntityAvatar: ReturnType<typeof vi.fn>;
  };

  const sampleUser: User = {
    id: 1,
    username: 'jacob',
    email: 'jacob@example.com',
    password: 'hashed-password',
    bio: null,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockRepository = {
      findOne: vi.fn(),
      create: vi.fn().mockImplementation((dto) => ({ ...dto, id: 1 })),
      save: vi.fn().mockImplementation((user) => Promise.resolve(user)),
    };

    mockAttachmentsService = {
      saveEntityAvatar: vi.fn().mockResolvedValue({
        id: 'uuid-1234',
        url: '/uploads/avatars/uuid-1234.png',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
        {
          provide: AttachmentsService,
          useValue: mockAttachmentsService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('createUser', () => {
    it('should create and save a new user with hashed password', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.createUser({
        username: 'jacob',
        email: 'jacob@example.com',
        password: 'password123',
      });

      expect(result.username).toBe('jacob');
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if email exists', async () => {
      mockRepository.findOne.mockResolvedValueOnce(sampleUser);

      await expect(
        service.createUser({
          username: 'jacob2',
          email: 'jacob@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should catch MySQL ER_DUP_ENTRY on email during save() race condition and throw 409', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.save.mockRejectedValueOnce({
        code: 'ER_DUP_ENTRY',
        errno: 1062,
        message: 'Duplicate entry for key users.IDX_97672ac88f789774dd47f7c8be',
      });

      await expect(
        service.createUser({
          username: 'jacob',
          email: 'jacob@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(new ConflictException('Email has already been taken'));
    });

    it('should catch MySQL ER_DUP_ENTRY on username during save() race condition and throw 409', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.save.mockRejectedValueOnce({
        code: 'ER_DUP_ENTRY',
        errno: 1062,
        message: 'Duplicate entry for key users.IDX_fe0bb3f6520ee0469504521e71',
      });

      await expect(
        service.createUser({
          username: 'jacob',
          email: 'jacob@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(
        new ConflictException('Username has already been taken'),
      );
    });

    it('should rethrow unexpected database errors during save()', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      const dbError = new Error('Database connection failed');
      mockRepository.save.mockRejectedValueOnce(dbError);

      await expect(
        service.createUser({
          username: 'jacob',
          email: 'jacob@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(dbError);
    });
  });

  describe('updateUser', () => {
    it('should update user bio and avatar via AttachmentsService', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      const currentUser: User = { ...sampleUser };
      const avatarFile = {
        fieldname: 'avatar',
        originalname: 'me.png',
        encoding: '7bit',
        mimetype: 'image/png',
        size: 1024,
        buffer: Buffer.from('fake-image'),
      };

      const result = await service.updateUser(
        currentUser,
        { bio: 'Updated bio' },
        avatarFile,
      );

      expect(result.user.bio).toBe('Updated bio');
      expect(result.user.image).toBe('/uploads/avatars/uuid-1234.png');
      expect(result.isPasswordChanged).toBe(false);
      expect(mockAttachmentsService.saveEntityAvatar).toHaveBeenCalledWith(
        'User',
        1,
        avatarFile,
      );
    });

    it('should hash new password and set isPasswordChanged to true', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      const currentUser: User = { ...sampleUser };

      const result = await service.updateUser(currentUser, {
        password: 'NewPassword123!',
      });

      expect(result.isPasswordChanged).toBe(true);
      expect(result.user.password).not.toBe('NewPassword123!');
    });

    it('should throw ConflictException when updating email to another existing user email', async () => {
      mockRepository.findOne.mockResolvedValueOnce({
        ...sampleUser,
        id: 2,
        email: 'taken@example.com',
      });
      const currentUser: User = { ...sampleUser };

      await expect(
        service.updateUser(currentUser, { email: 'taken@example.com' }),
      ).rejects.toThrow(new ConflictException('Email has already been taken'));
    });
  });

  describe('validateCredentials', () => {
    it('should return user when credentials match', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      mockRepository.findOne.mockResolvedValue({
        ...sampleUser,
        password: hashedPassword,
      });

      const user = await service.validateCredentials(
        'jacob@example.com',
        'password123',
      );
      expect(user).toBeDefined();
      expect(user?.email).toBe('jacob@example.com');
    });

    it('should return null when password is wrong', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      mockRepository.findOne.mockResolvedValue({
        ...sampleUser,
        password: hashedPassword,
      });

      const user = await service.validateCredentials(
        'jacob@example.com',
        'wrongpassword',
      );
      expect(user).toBeNull();
    });
  });
});
