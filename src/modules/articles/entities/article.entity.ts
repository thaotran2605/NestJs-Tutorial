import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import {
  ARTICLE_DESCRIPTION_MAX_LENGTH,
  ARTICLE_SLUG_MAX_LENGTH,
  ARTICLE_TITLE_MAX_LENGTH,
} from '../articles.constants.js';
import { Tag } from './tag.entity.js';

@Entity('articles')
@Index('IDX_articles_author_id', ['authorId'])
@Index('IDX_articles_created_at', ['createdAt'])
export class Article {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: ARTICLE_SLUG_MAX_LENGTH, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: ARTICLE_TITLE_MAX_LENGTH })
  title: string;

  @Column({ type: 'varchar', length: ARTICLE_DESCRIPTION_MAX_LENGTH })
  description: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'author_id', type: 'int' })
  authorId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @ManyToMany(() => Tag)
  @JoinTable({
    name: 'article_tags',
    joinColumn: { name: 'article_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: Tag[];

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt: Date;
}
