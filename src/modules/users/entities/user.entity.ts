import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  EMAIL_MAX_LENGTH,
  IMAGE_URL_MAX_LENGTH,
  INITIAL_TOKEN_VERSION,
} from '../../auth/auth.constants.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  username: string;

  @Column({ type: 'varchar', length: EMAIL_MAX_LENGTH, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'varchar', length: IMAGE_URL_MAX_LENGTH, nullable: true })
  image: string | null;

  @Column({
    name: 'token_version',
    type: 'int',
    default: INITIAL_TOKEN_VERSION,
  })
  tokenVersion: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt: Date;
}
