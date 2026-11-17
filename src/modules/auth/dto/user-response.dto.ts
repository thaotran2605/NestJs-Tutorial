import { ApiProperty } from '@nestjs/swagger';

export class UserPayloadDto {
  @ApiProperty({ example: 'jake@jake.jake' })
  email: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  token: string;

  @ApiProperty({ example: 'Jacob' })
  username: string;

  @ApiProperty({ example: 'I work at statefarm', nullable: true })
  bio: string | null;

  @ApiProperty({ example: 'https://api.realworld.io/images/smiley-cyrus.jpg', nullable: true })
  image: string | null;
}

export class UserResponseDto {
  @ApiProperty({ type: UserPayloadDto })
  user: UserPayloadDto;
}
