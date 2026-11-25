import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TAG_NAME_MAX_LENGTH } from '../articles.constants.js';

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: TAG_NAME_MAX_LENGTH, unique: true })
  name: string;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt: Date;
}
