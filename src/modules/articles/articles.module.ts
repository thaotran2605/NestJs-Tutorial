import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenModule } from '../auth/token.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { ArticlesController } from './articles.controller.js';
import { ArticlesService } from './articles.service.js';
import { ArticleFavorite } from './entities/article-favorite.entity.js';
import { Article } from './entities/article.entity.js';
import { Tag } from './entities/tag.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Article, Tag, ArticleFavorite]),
    ProfilesModule,
    TokenModule,
  ],
  controllers: [ArticlesController],
  providers: [ArticlesService],
  exports: [ArticlesService, TypeOrmModule],
})
export class ArticlesModule {}
