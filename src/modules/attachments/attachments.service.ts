import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
  ) {}

  async saveEntityAvatar(
    entityType: string,
    entityId: number,
    file: UploadedAvatarFile,
  ): Promise<Attachment> {
    this.validateImageFile(file);

    const extension = MIME_TO_EXTENSION[file.mimetype];
    const fileUuid = randomUUID();
    const storedFileName = `${fileUuid}${extension}`;

    const uploadDir = path.resolve(
      process.cwd(),
      PUBLIC_DIR_NAME,
      AVATAR_UPLOAD_SUBDIR,
    );
    await fs.mkdir(uploadDir, { recursive: true });

    const targetFilePath = path.join(uploadDir, storedFileName);
    await fs.writeFile(targetFilePath, file.buffer);

    const sanitizedOriginalName = this.sanitizeOriginalFileName(
      file.originalname,
    );
    const publicUrl = `/${AVATAR_UPLOAD_SUBDIR}/${storedFileName}`;

    const existingAttachments = await this.attachmentRepository.find({
      where: { entityType, entityId },
    });

    const newAttachment = this.attachmentRepository.create({
      id: fileUuid,
      entityType,
      entityId,
      fileName: sanitizedOriginalName,
      fileType: file.mimetype,
      fileSize: file.size,
      url: publicUrl,
    });

    const savedAttachment = await this.attachmentRepository.save(newAttachment);

    if (existingAttachments.length > 0) {
      await this.removeOldAttachments(existingAttachments, uploadDir);
    }

    return savedAttachment;
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

  private validateImageFile(file: UploadedAvatarFile): void {
    if (!file || !file.buffer || file.size <= 0) {
      throw new BadRequestException('Uploaded file is empty or invalid');
    }

    if (file.size > MAX_AVATAR_FILE_SIZE) {
      throw new BadRequestException('File size exceeds the 2MB limit');
    }

    const extension = MIME_TO_EXTENSION[file.mimetype];
    if (!extension) {
      throw new BadRequestException(
        'Only image files (jpeg, png, webp, gif) are allowed',
      );
    }
  }

  private sanitizeOriginalFileName(originalName: string): string {
    const baseName = path.basename(originalName || 'avatar');
    const cleaned = baseName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, ATTACHMENT_FILE_NAME_MAX_LENGTH);
    return cleaned || 'avatar';
  }

  private async removeOldAttachments(
    oldAttachments: Attachment[],
    uploadDir: string,
  ): Promise<void> {
    for (const old of oldAttachments) {
      const oldStoredFile = path.basename(old.url);
      if (oldStoredFile) {
        const oldFilePath = path.join(uploadDir, oldStoredFile);
        try {
          await fs.unlink(oldFilePath);
        } catch (error) {
          Logger.warn(
            {
              message: 'Could not delete old attachment file from disk',
              action: 'Verify file permissions or ignore if already removed',
              fileUrl: old.url,
              reason: error instanceof Error ? error.message : String(error),
            },
            AttachmentsService.name,
          );
        }
      }
    }

    const oldIds = oldAttachments.map((item) => item.id);
    await this.attachmentRepository.delete(oldIds);
  }
}
