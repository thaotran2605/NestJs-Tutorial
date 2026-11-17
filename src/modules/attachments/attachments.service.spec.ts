import * as fs from 'node:fs/promises';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MAX_AVATAR_FILE_SIZE } from './attachments.constants.js';
import {
  AttachmentsService,
  UploadedAvatarFile,
} from './attachments.service.js';
import { Attachment } from './entities/attachment.entity.js';

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let mockRepository: {
    find: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  const validImageFile: UploadedAvatarFile = {
    fieldname: 'avatar',
    originalname: 'my avatar!.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 2048,
    buffer: Buffer.from('fake-png-content'),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockRepository = {
      find: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation((dto) => dto),
      save: vi
        .fn()
        .mockImplementation((attachment) => Promise.resolve(attachment)),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        {
          provide: getRepositoryToken(Attachment),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<AttachmentsService>(AttachmentsService);
  });

  describe('saveEntityAvatar', () => {
    it('should save a valid image file to disk, create attachment record, and sanitize filename', async () => {
      const result = await service.saveEntityAvatar('User', 1, validImageFile);

      expect(result.id).toBeDefined();
      expect(result.entityType).toBe('User');
      expect(result.entityId).toBe(1);
      expect(result.fileName).toBe('my_avatar_.png');
      expect(result.fileType).toBe('image/png');
      expect(result.fileSize).toBe(2048);
      expect(result.url).toMatch(/^\/uploads\/avatars\/[0-9a-f-]+\.png$/);
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should delete previous attachments from disk and DB when saving a new avatar', async () => {
      mockRepository.find.mockResolvedValueOnce([
        {
          id: 'old-uuid',
          entityType: 'User',
          entityId: 1,
          url: '/uploads/avatars/old-uuid.jpg',
        },
      ]);

      await service.saveEntityAvatar('User', 1, validImageFile);

      expect(fs.unlink).toHaveBeenCalled();
      expect(mockRepository.delete).toHaveBeenCalledWith(['old-uuid']);
    });

    it('should throw BadRequestException if file exceeds 2MB size limit', async () => {
      const oversizedFile: UploadedAvatarFile = {
        ...validImageFile,
        size: MAX_AVATAR_FILE_SIZE + 100,
      };

      await expect(
        service.saveEntityAvatar('User', 1, oversizedFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if MIME type is not an allowed image format', async () => {
      const invalidTypeFile: UploadedAvatarFile = {
        ...validImageFile,
        mimetype: 'application/pdf',
      };

      await expect(
        service.saveEntityAvatar('User', 1, invalidTypeFile),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findByEntity', () => {
    it('should query attachments by entityType and entityId', async () => {
      await service.findByEntity('User', 1);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { entityType: 'User', entityId: 1 },
        order: { createdAt: 'DESC' },
      });
    });
  });
});
