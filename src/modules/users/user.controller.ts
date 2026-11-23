import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { I18nContext } from 'nestjs-i18n';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RawToken } from '../../common/decorators/raw-token.decorator.js';
import {
  MAX_AVATAR_FILES_COUNT,
  MAX_AVATAR_FILE_SIZE,
  MIME_TO_EXTENSION,
} from '../attachments/attachments.constants.js';
import type { UploadedAvatarFile } from '../attachments/attachments.service.js';
import { UserResponseDto } from '../auth/dto/user-response.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { User } from './entities/user.entity.js';
import { UsersService } from './users.service.js';

@ApiTags('Current User')
@Controller('user')
export class UserController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Current user retrieved successfully',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getCurrentUser(
    @CurrentUser() user: User,
    @RawToken() token: string,
  ): UserResponseDto {
    return this.usersService.getCurrentUser(user, token);
  }

  @Put()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: {
        fileSize: MAX_AVATAR_FILE_SIZE,
        files: MAX_AVATAR_FILES_COUNT,
      },
      fileFilter: (_req, file, callback) => {
        if (!MIME_TO_EXTENSION[file.mimetype]) {
          const i18n = I18nContext.current();
          const message = i18n
            ? i18n.t('errors.ATTACHMENT_INVALID_TYPE')
            : 'Only image files (jpeg, png, webp, gif) are allowed';
          callback(new BadRequestException(message), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    description:
      'Update user info via multipart/form-data (with optional avatar file) or application/json ({ user: { ... } })',
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'jacob_new@example.com' },
        username: { type: 'string', example: 'jacob_new' },
        password: { type: 'string', example: 'NewPassword123!' },
        bio: { type: 'string', example: 'I work at statefarm' },
        image: { type: 'string', example: '/uploads/avatars/sample.png' },
        avatar: {
          type: 'string',
          format: 'binary',
          description:
            'Optional avatar image file (jpeg, png, webp, gif, max 2MB)',
        },
      },
    },
  })
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @ApiOperation({
    summary: 'Update current user profile and optionally upload avatar',
  })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input or file format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Email or username already taken' })
  async updateCurrentUser(
    @CurrentUser() user: User,
    @RawToken() token: string,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() avatarFile?: UploadedAvatarFile,
  ): Promise<UserResponseDto> {
    return this.usersService.updateCurrentUser(
      user,
      token,
      updateUserDto,
      avatarFile,
    );
  }
}
