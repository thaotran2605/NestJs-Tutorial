import { ApiProperty } from '@nestjs/swagger';

export class CommentAuthorDto {
  @ApiProperty({ example: 'jake' })
  username: string;

  @ApiProperty({ example: 'I work at statefarm', nullable: true })
  bio: string | null;

  @ApiProperty({ example: '/uploads/avatars/avatar.png', nullable: true })
  image: string | null;

  @ApiProperty({ example: false })
  following: boolean;
}

export class CommentDataDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: '2026-11-25T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-11-25T10:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ example: 'It takes a Jacobian' })
  body: string;

  @ApiProperty({ type: CommentAuthorDto })
  author: CommentAuthorDto;
}

export class CommentResponseDto {
  @ApiProperty({ type: CommentDataDto })
  comment: CommentDataDto;
}

export class MultipleCommentsResponseDto {
  @ApiProperty({ type: [CommentDataDto] })
  comments: CommentDataDto[];
}
