import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { EntityManager, Repository } from 'typeorm';
import { translateWithContext } from '../../common/utils/i18n.helper.js';
import {
  ATTACHMENT_FILE_NAME_MAX_LENGTH,
  AVATAR_UPLOAD_SUBDIR,
  MAX_AVATAR_FILE_SIZE,
  MIME_TO_EXTENSION,
  PUBLIC_DIR_NAME,
} from './attachments.constants.js';
import { Attachment } from './entities/attachment.entity.js';

export interface UploadedAvatarFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface PreparedAvatarFile {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
  diskPath: string;
}

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    private readonly i18n: I18nService,
  ) {}

  validateImageFile(file: UploadedAvatarFile): void {
    if (!file || !file.buffer || file.size <= 0) {
      throw new BadRequestException(
        translateWithContext(this.i18n, 'errors.ATTACHMENT_EMPTY_OR_INVALID'),
      );
    }

    if (file.size > MAX_AVATAR_FILE_SIZE) {
      throw new BadRequestException(
        translateWithContext(this.i18n, 'errors.ATTACHMENT_SIZE_EXCEEDED'),
      );
    }

    const extension = MIME_TO_EXTENSION[file.mimetype];
    if (!extension) {
      throw new BadRequestException(
        translateWithContext(this.i18n, 'errors.ATTACHMENT_INVALID_TYPE'),
      );
    }
  }

  async prepareAndWriteAvatarFile(
    file: UploadedAvatarFile,
  ): Promise<PreparedAvatarFile> {
    this.validateImageFile(file);

    const extension = MIME_TO_EXTENSION[file.mimetype];
    const fileUuid = randomUUID();
    const storedFileName = `${fileUuid}${extension}`;

    const uploadDir = this.getAvatarUploadDir();
    await fs.mkdir(uploadDir, { recursive: true });

    const targetFilePath = path.join(uploadDir, storedFileName);
    await fs.writeFile(targetFilePath, file.buffer);

    return {
      id: fileUuid,
      fileName: this.sanitizeOriginalFileName(file.originalname),
      fileType: file.mimetype,
      fileSize: file.size,
      url: `/${AVATAR_UPLOAD_SUBDIR}/${storedFileName}`,
      diskPath: targetFilePath,
    };
  }

  async replaceEntityAttachmentInTx(
    manager: EntityManager,
    entityType: string,
    entityId: number,
    preparedFile: PreparedAvatarFile,
  ): Promise<string[]> {
    const existingAttachments = await manager.find(Attachment, {
      where: { entityType, entityId },
    });

    const oldUrls = existingAttachments.map((item) => item.url);

    if (existingAttachments.length > 0) {
      await manager.delete(
        Attachment,
        existingAttachments.map((item) => item.id),
      );
    }

    const newAttachment = manager.create(Attachment, {
      id: preparedFile.id,
      entityType,
      entityId,
      fileName: preparedFile.fileName,
      fileType: preparedFile.fileType,
      fileSize: preparedFile.fileSize,
      url: preparedFile.url,
    });

    await manager.save(Attachment, newAttachment);
    return oldUrls;
  }

  async deleteAvatarFilesFromDisk(urls: string[]): Promise<void> {
    const uploadDir = this.getAvatarUploadDir();

    for (const url of urls) {
      if (!url.startsWith(`/${AVATAR_UPLOAD_SUBDIR}/`)) {
        continue;
      }
      const storedFile = path.basename(url);
      if (storedFile) {
        await this.deleteDiskFile(path.join(uploadDir, storedFile));
      }
    }
  }

  async deleteDiskFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      Logger.warn(
        {
          message: 'Could not delete attachment file from disk',
          action: 'Verify file permissions or ignore if already removed',
          filePath,
          reason: error instanceof Error ? error.message : String(error),
        },
        AttachmentsService.name,
      );
    }
  }

  async findByEntity(
    entityType: string,
    entityId: number,
  ): Promise<Attachment[]> {
    return this.attachmentRepository.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
    });
  }

  private getAvatarUploadDir(): string {
    return path.resolve(process.cwd(), PUBLIC_DIR_NAME, AVATAR_UPLOAD_SUBDIR);
  }

  private sanitizeOriginalFileName(originalName: string): string {
    const baseName = path.basename(originalName || 'avatar');
    const cleaned = baseName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, ATTACHMENT_FILE_NAME_MAX_LENGTH);
    return cleaned || 'avatar';
  }
}
