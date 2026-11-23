import * as fs from 'node:fs/promises';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { EntityManager } from 'typeorm';
import { MAX_AVATAR_FILE_SIZE } from './attachments.constants.js';
import {
  AttachmentsService,
  PreparedAvatarFile,
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
  };
  let mockI18nService: {
    t: ReturnType<typeof vi.fn>;
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
    };

    mockI18nService = {
      t: vi.fn((key: string) => key),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        {
          provide: getRepositoryToken(Attachment),
          useValue: mockRepository,
        },
        {
          provide: I18nService,
          useValue: mockI18nService,
        },
      ],
    }).compile();

    service = module.get<AttachmentsService>(AttachmentsService);
  });

  describe('validateImageFile & prepareAndWriteAvatarFile', () => {
    it('should write a valid image file to disk and return prepared metadata', async () => {
      const prepared = await service.prepareAndWriteAvatarFile(validImageFile);

      expect(prepared.id).toBeDefined();
      expect(prepared.fileName).toBe('my_avatar_.png');
      expect(prepared.fileType).toBe('image/png');
      expect(prepared.fileSize).toBe(2048);
      expect(prepared.url).toMatch(/^\/uploads\/avatars\/[0-9a-f-]+\.png$/);
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(
        prepared.diskPath,
        validImageFile.buffer,
      );
    });

    it('should throw localized BadRequestException if file exceeds 2MB size limit', async () => {
      const oversizedFile: UploadedAvatarFile = {
        ...validImageFile,
        size: MAX_AVATAR_FILE_SIZE + 100,
      };

      await expect(
        service.prepareAndWriteAvatarFile(oversizedFile),
      ).rejects.toThrow(new BadRequestException('errors.ATTACHMENT_SIZE_EXCEEDED'));
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should throw localized BadRequestException if MIME type is not an allowed image format', async () => {
      const invalidTypeFile: UploadedAvatarFile = {
        ...validImageFile,
        mimetype: 'application/pdf',
      };

      await expect(
        service.prepareAndWriteAvatarFile(invalidTypeFile),
      ).rejects.toThrow(new BadRequestException('errors.ATTACHMENT_INVALID_TYPE'));
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should throw localized BadRequestException if file buffer is empty', () => {
      const emptyFile: UploadedAvatarFile = {
        ...validImageFile,
        size: 0,
      };

      expect(() => service.validateImageFile(emptyFile)).toThrow(
        new BadRequestException('errors.ATTACHMENT_EMPTY_OR_INVALID'),
      );
    });
  });

  describe('replaceEntityAttachmentInTx', () => {
    it('should replace attachment records within transaction without deleting files from disk', async () => {
      const mockManager = {
        find: vi.fn().mockResolvedValue([
          {
            id: 'old-uuid',
            url: '/uploads/avatars/old-uuid.jpg',
          },
        ]),
        delete: vi.fn().mockResolvedValue({ affected: 1 }),
        create: vi.fn().mockImplementation((_entity, data) => data),
        save: vi.fn().mockImplementation((_entity, data) => Promise.resolve(data)),
      } as unknown as EntityManager;

      const prepared: PreparedAvatarFile = {
        id: 'new-uuid',
        fileName: 'avatar.png',
        fileType: 'image/png',
        fileSize: 2048,
        url: '/uploads/avatars/new-uuid.png',
        diskPath: '/tmp/new-uuid.png',
      };

      const oldUrls = await service.replaceEntityAttachmentInTx(
        mockManager,
        'User',
        1,
        prepared,
      );

      expect(oldUrls).toEqual(['/uploads/avatars/old-uuid.jpg']);
      expect(mockManager.delete).toHaveBeenCalledWith(Attachment, ['old-uuid']);
      expect(mockManager.save).toHaveBeenCalled();
      expect(fs.unlink).not.toHaveBeenCalled();
    });
  });

  describe('deleteAvatarFilesFromDisk & deleteDiskFile', () => {
    it('should unlink local avatar files only after explicit post-commit call', async () => {
      await service.deleteAvatarFilesFromDisk([
        '/uploads/avatars/old-uuid.jpg',
        'https://example.com/external.png',
      ]);

      expect(fs.unlink).toHaveBeenCalledTimes(1);
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
