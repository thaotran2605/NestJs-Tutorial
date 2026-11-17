import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  ATTACHMENT_ENTITY_TYPE_MAX_LENGTH,
  ATTACHMENT_FILE_NAME_MAX_LENGTH,
  ATTACHMENT_FILE_TYPE_MAX_LENGTH,
  ATTACHMENT_URL_MAX_LENGTH,
} from '../attachments.constants.js';

@Entity('attachments')
@Index('IDX_attachments_entity', ['entityType', 'entityId'])
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'entity_type',
    type: 'varchar',
    length: ATTACHMENT_ENTITY_TYPE_MAX_LENGTH,
  })
  entityType: string;

  @Column({ name: 'entity_id', type: 'int' })
  entityId: number;

  @Column({
    name: 'file_name',
    type: 'varchar',
    length: ATTACHMENT_FILE_NAME_MAX_LENGTH,
  })
  fileName: string;

  @Column({
    name: 'file_type',
    type: 'varchar',
    length: ATTACHMENT_FILE_TYPE_MAX_LENGTH,
  })
  fileType: string;

  @Column({ name: 'file_size', type: 'int' })
  fileSize: number;

  @Column({ type: 'varchar', length: ATTACHMENT_URL_MAX_LENGTH })
  url: string;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt: Date;
}
