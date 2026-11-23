import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { I18nService } from 'nestjs-i18n';
import { AttachmentsService } from '../attachments/attachments.service.js';
import { TokenService } from '../auth/token.service.js';
import { User } from './entities/user.entity.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;
  let mockRepository: {
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    manager: {
      transaction: ReturnType<typeof vi.fn>;
    };
  };
  let mockManager: {
    save: ReturnType<typeof vi.fn>;
  };
  let mockDataSource: {
    transaction: ReturnType<typeof vi.fn>;
  };
  let mockAttachmentsService: {
    validateImageFile: ReturnType<typeof vi.fn>;
    prepareAndWriteAvatarFile: ReturnType<typeof vi.fn>;
    replaceEntityAttachmentInTx: ReturnType<typeof vi.fn>;
    deleteAvatarFilesFromDisk: ReturnType<typeof vi.fn>;
    deleteDiskFile: ReturnType<typeof vi.fn>;
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
    bio: null,
    image: '/uploads/avatars/old-avatar.png',
    tokenVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockManager = {
      save: vi.fn().mockImplementation((_entity, user) => Promise.resolve(user)),
    };

    mockDataSource = {
      transaction: vi.fn().mockImplementation((callback) => callback(mockManager)),
    };

    mockRepository = {
      findOne: vi.fn(),
      create: vi.fn().mockImplementation((dto) => ({ ...dto, id: 1 })),
      save: vi.fn().mockImplementation((user) => Promise.resolve(user)),
      manager: mockDataSource,
    };

    mockAttachmentsService = {
      validateImageFile: vi.fn(),
      prepareAndWriteAvatarFile: vi.fn().mockResolvedValue({
        id: 'new-uuid-1234',
        fileName: 'me.png',
        fileType: 'image/png',
        fileSize: 1024,
        url: '/uploads/avatars/new-uuid-1234.png',
        diskPath: '/tmp/uploads/avatars/new-uuid-1234.png',
      }),
      replaceEntityAttachmentInTx: vi
        .fn()
        .mockResolvedValue(['/uploads/avatars/old-avatar.png']),
      deleteAvatarFilesFromDisk: vi.fn().mockResolvedValue(undefined),
      deleteDiskFile: vi.fn().mockResolvedValue(undefined),
    };

    mockTokenService = {
      generateToken: vi.fn().mockResolvedValue('new-jwt-token'),
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
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
        {
          provide: AttachmentsService,
          useValue: mockAttachmentsService,
        },
        {
          provide: TokenService,
          useValue: mockTokenService,
        },
        {
          provide: I18nService,
          useValue: mockI18nService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('createUser', () => {
    it('should create and save a new user with hashed password and initial tokenVersion', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.createUser({
        username: 'jacob',
        email: 'jacob@example.com',
        password: 'password123',
      });

      expect(result.username).toBe('jacob');
      expect(result.tokenVersion).toBe(1);
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
      ).rejects.toThrow(new ConflictException('errors.USER_EMAIL_TAKEN'));
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
      ).rejects.toThrow(new ConflictException('errors.USER_EMAIL_TAKEN'));
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
      ).rejects.toThrow(new ConflictException('errors.USER_USERNAME_TAKEN'));
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

  describe('updateCurrentUser', () => {
    const avatarFile = {
      fieldname: 'avatar',
      originalname: 'me.png',
      encoding: '7bit',
      mimetype: 'image/png',
      size: 1024,
      buffer: Buffer.from('fake-image'),
    };

    it('should save user and attachment in one transaction and delete old files only after commit', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.updateCurrentUser(
        sampleUser,
        'current-token',
        { user: { bio: 'Updated bio' } },
        avatarFile,
      );

      expect(result.user.bio).toBe('Updated bio');
      expect(result.user.image).toBe('/uploads/avatars/new-uuid-1234.png');
      expect(result.user.token).toBe('current-token');
      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(
        mockAttachmentsService.replaceEntityAttachmentInTx,
      ).toHaveBeenCalledWith(mockManager, 'User', 1, expect.any(Object));
      expect(
        mockAttachmentsService.deleteAvatarFilesFromDisk,
      ).toHaveBeenCalledWith(['/uploads/avatars/old-avatar.png']);
      expect(mockAttachmentsService.deleteDiskFile).not.toHaveBeenCalled();
    });

    it('should clean up new file and keep old files intact if transaction fails with ER_DUP_ENTRY', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockManager.save.mockRejectedValueOnce({
        code: 'ER_DUP_ENTRY',
        errno: 1062,
        message: 'Duplicate entry for key users.IDX_fe0bb3f6520ee0469504521e71',
      });

      await expect(
        service.updateCurrentUser(
          sampleUser,
          'current-token',
          { username: 'race_taken_user' },
          avatarFile,
        ),
      ).rejects.toThrow(new ConflictException('errors.USER_USERNAME_TAKEN'));

      expect(mockAttachmentsService.deleteDiskFile).toHaveBeenCalledWith(
        '/tmp/uploads/avatars/new-uuid-1234.png',
      );
      expect(
        mockAttachmentsService.deleteAvatarFilesFromDisk,
      ).not.toHaveBeenCalled();
    });

    it('should increment tokenVersion, revoke current token, and issue new token when password changes', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.updateCurrentUser(
        sampleUser,
        'old-token',
        { password: 'NewPassword123!' },
      );

      expect(mockManager.save).toHaveBeenCalledWith(
        User,
        expect.objectContaining({
          tokenVersion: 2,
        }),
      );
      expect(mockTokenService.revokeToken).toHaveBeenCalledWith('old-token');
      expect(mockTokenService.generateToken).toHaveBeenCalled();
      expect(result.user.token).toBe('new-jwt-token');
    });

    it('should throw ConflictException when updating email to another existing user email', async () => {
      mockRepository.findOne.mockResolvedValueOnce({
        ...sampleUser,
        id: 2,
        email: 'taken@example.com',
      });

      await expect(
        service.updateCurrentUser(sampleUser, 'current-token', {
          email: 'taken@example.com',
        }),
      ).rejects.toThrow(new ConflictException('errors.USER_EMAIL_TAKEN'));
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
