import { ApiProperty } from '@nestjs/swagger';

export class ArticleAuthorDto {
  @ApiProperty({ example: 'jake' })
  username: string;

  @ApiProperty({ example: 'I work at statefarm', nullable: true })
  bio: string | null;

  @ApiProperty({ example: '/uploads/avatars/avatar.png', nullable: true })
  image: string | null;

  @ApiProperty({ example: false })
  following: boolean;
}

export class ArticleDataDto {
  @ApiProperty({ example: 'how-to-train-your-dragon-a1b2c3' })
  slug: string;

  @ApiProperty({ example: 'How to train your dragon' })
  title: string;

  @ApiProperty({ example: 'Ever wonder how?' })
  description: string;

  @ApiProperty({ example: 'It takes a Jacobian' })
  body: string;

  @ApiProperty({ example: ['dragons', 'reactjs'], type: [String] })
  tagList: string[];

  @ApiProperty({ example: '2026-11-23T07:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-11-23T07:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ example: false })
  favorited: boolean;

  @ApiProperty({ example: 0 })
  favoritesCount: number;

  @ApiProperty({ type: ArticleAuthorDto })
  author: ArticleAuthorDto;
}

export class ArticleResponseDto {
  @ApiProperty({ type: ArticleDataDto })
  article: ArticleDataDto;
}

export class MultipleArticlesResponseDto {
  @ApiProperty({ type: [ArticleDataDto] })
  articles: ArticleDataDto[];

  @ApiProperty({ example: 1 })
  articlesCount: number;
}
