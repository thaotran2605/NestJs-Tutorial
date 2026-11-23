import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { Article } from './article.entity.js';

@Entity('article_favorites')
@Index('IDX_article_favorites_article_id', ['articleId'])
export class ArticleFavorite {
  @PrimaryColumn({ name: 'user_id', type: 'int' })
  userId: number;

  @PrimaryColumn({ name: 'article_id', type: 'int' })
  articleId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Article, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'article_id' })
  article: Article;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt: Date;
}
