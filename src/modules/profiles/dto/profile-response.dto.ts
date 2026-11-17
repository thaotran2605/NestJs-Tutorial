import { ApiProperty } from '@nestjs/swagger';

export class ProfileDataDto {
  @ApiProperty({ example: 'jacob' })
  username: string;

  @ApiProperty({ example: 'I work at statefarm', nullable: true })
  bio: string | null;

  @ApiProperty({
    example: '/uploads/avatars/a1b2c3d4.png',
    nullable: true,
  })
  image: string | null;

  @ApiProperty({ example: false })
  following: boolean;
}

export class ProfileResponseDto {
  @ApiProperty({ type: ProfileDataDto })
  profile: ProfileDataDto;
}
