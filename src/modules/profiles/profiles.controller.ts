import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { User } from '../users/entities/user.entity.js';
import { ProfileResponseDto } from './dto/profile-response.dto.js';
import { ProfilesService } from './profiles.service.js';

@ApiTags('Profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get(':username')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @ApiOperation({ summary: 'Get user profile by username' })
  @ApiParam({ name: 'username', description: 'Username of the profile to get' })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async getProfile(
    @Param('username') username: string,
    @CurrentUser() currentUser?: User,
  ): Promise<ProfileResponseDto> {
    return this.profilesService.getProfile(username, currentUser);
  }

  @Post(':username/follow')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @ApiOperation({ summary: 'Follow a user by username' })
  @ApiParam({ name: 'username', description: 'Username of the user to follow' })
  @ApiResponse({
    status: 200,
    description: 'User followed successfully',
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Cannot follow yourself' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async followUser(
    @Param('username') username: string,
    @CurrentUser() currentUser: User,
  ): Promise<ProfileResponseDto> {
    return this.profilesService.followUser(username, currentUser);
  }

  @Delete(':username/follow')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @ApiOperation({ summary: 'Unfollow a user by username' })
  @ApiParam({
    name: 'username',
    description: 'Username of the user to unfollow',
  })
  @ApiResponse({
    status: 200,
    description: 'User unfollowed successfully',
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Cannot unfollow yourself' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async unfollowUser(
    @Param('username') username: string,
    @CurrentUser() currentUser: User,
  ): Promise<ProfileResponseDto> {
    return this.profilesService.unfollowUser(username, currentUser);
  }
}
