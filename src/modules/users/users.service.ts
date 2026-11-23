import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { I18nService } from 'nestjs-i18n';
import { Repository } from 'typeorm';
import { translateWithContext } from '../../common/utils/i18n.helper.js';
import { ATTACHMENT_ENTITY_TYPE_USER } from '../attachments/attachments.constants.js';
import {
  AttachmentsService,
  PreparedAvatarFile,
  UploadedAvatarFile,
} from '../attachments/attachments.service.js';
import {
  BCRYPT_SALT_ROUNDS,
  INITIAL_TOKEN_VERSION,
} from '../auth/auth.constants.js';
import { CreateUserDto } from '../auth/dto/register.dto.js';
import { UserResponseDto } from '../auth/dto/user-response.dto.js';
import { TokenService } from '../auth/token.service.js';
import { UpdateUserDataDto, UpdateUserDto } from './dto/update-user.dto.js';
import { User } from './entities/user.entity.js';

// Pre-computed bcrypt hash used to prevent timing attacks (user enumeration)
const DUMMY_HASH =
  '$2b$10$wTfI2zI6wZ0lYFk51Jz35.Q4H21O0yA/vQ2d2Y5c6F7v8u9w0x1y2';
const MYSQL_ER_DUP_ENTRY = 'ER_DUP_ENTRY';
const MYSQL_ERRNO_DUP_ENTRY = 1062;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly attachmentsService: AttachmentsService,
    private readonly tokenService: TokenService,
    private readonly i18n: I18nService,
  ) {}

  async createUser(dto: CreateUserDto): Promise<User> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedUsername = dto.username.trim();

    const existingEmail = await this.findByEmail(normalizedEmail);
    if (existingEmail) {
      throw new ConflictException(
        translateWithContext(this.i18n, 'errors.USER_EMAIL_TAKEN'),
      );
    }

    const existingUsername = await this.findByUsername(normalizedUsername);
    if (existingUsername) {
      throw new ConflictException(
        translateWithContext(this.i18n, 'errors.USER_USERNAME_TAKEN'),
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    try {
      const user = this.userRepository.create({
        username: normalizedUsername,
        email: normalizedEmail,
        password: hashedPassword,
        tokenVersion: INITIAL_TOKEN_VERSION,
      });

      return await this.userRepository.save(user);
    } catch (error: unknown) {
      this.handleDuplicateKeyError(error);
      throw error;
    }
  }

  getCurrentUser(user: User, token: string): UserResponseDto {
    return this.tokenService.formatUserResponse(user, token);
  }

  async updateCurrentUser(
    currentUser: User,
    currentToken: string,
    dto: UpdateUserDto,
    avatarFile?: UploadedAvatarFile,
  ): Promise<UserResponseDto> {
    const updateData: UpdateUserDataDto = dto.user ?? dto;

    if (avatarFile) {
      this.attachmentsService.validateImageFile(avatarFile);
    }

    const userToSave: User = Object.assign(new User(), currentUser);

    if (updateData.email !== undefined) {
      const normalizedEmail = updateData.email.trim().toLowerCase();
      if (normalizedEmail !== currentUser.email) {
        const existingEmail = await this.findByEmail(normalizedEmail);
        if (existingEmail && existingEmail.id !== currentUser.id) {
          throw new ConflictException(
            translateWithContext(this.i18n, 'errors.USER_EMAIL_TAKEN'),
          );
        }
        userToSave.email = normalizedEmail;
      }
    }

    if (updateData.username !== undefined) {
      const normalizedUsername = updateData.username.trim();
      if (normalizedUsername !== currentUser.username) {
        const existingUsername = await this.findByUsername(normalizedUsername);
        if (existingUsername && existingUsername.id !== currentUser.id) {
          throw new ConflictException(
            translateWithContext(this.i18n, 'errors.USER_USERNAME_TAKEN'),
          );
        }
        userToSave.username = normalizedUsername;
      }
    }

    let isPasswordChanged = false;
    if (updateData.password !== undefined) {
      userToSave.password = await bcrypt.hash(
        updateData.password,
        BCRYPT_SALT_ROUNDS,
      );
      userToSave.tokenVersion =
        (currentUser.tokenVersion ?? INITIAL_TOKEN_VERSION) + 1;
      isPasswordChanged = true;
    }

    if (updateData.bio !== undefined) {
      userToSave.bio = updateData.bio;
    }

    if (!avatarFile && updateData.image !== undefined) {
      userToSave.image = updateData.image;
    }

    let preparedAvatar: PreparedAvatarFile | undefined;
    if (avatarFile) {
      preparedAvatar =
        await this.attachmentsService.prepareAndWriteAvatarFile(avatarFile);
    }

    let oldAvatarUrls: string[] = [];
    let savedUser: User;

    try {
      savedUser = await this.userRepository.manager.transaction(
        async (manager) => {
        if (preparedAvatar) {
          oldAvatarUrls =
            await this.attachmentsService.replaceEntityAttachmentInTx(
              manager,
              ATTACHMENT_ENTITY_TYPE_USER,
              userToSave.id,
              preparedAvatar,
            );
          userToSave.image = preparedAvatar.url;
        }

        return manager.save(User, userToSave);
      });
    } catch (error: unknown) {
      if (preparedAvatar) {
        await this.attachmentsService.deleteDiskFile(preparedAvatar.diskPath);
      }
      this.handleDuplicateKeyError(error);
      throw error;
    }

    if (oldAvatarUrls.length > 0) {
      await this.attachmentsService.deleteAvatarFilesFromDisk(oldAvatarUrls);
    }

    let activeToken = currentToken;
    if (isPasswordChanged) {
      await this.tokenService.revokeToken(currentToken);
      activeToken = await this.tokenService.generateToken(savedUser);
    }

    return this.tokenService.formatUserResponse(savedUser, activeToken);
  }

  async findById(id: number): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.trim().toLowerCase();
    return this.userRepository.findOne({ where: { email: normalizedEmail } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { username: username.trim() } });
  }

  async validateCredentials(
    email: string,
    plainPassword: string,
  ): Promise<User | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.findByEmail(normalizedEmail);

    // Always run bcrypt.compare to guarantee constant execution time
    const hashToCompare = user ? user.password : DUMMY_HASH;
    const isPasswordValid = await bcrypt.compare(plainPassword, hashToCompare);

    if (!user || !isPasswordValid) {
      return null;
    }

    return user;
  }

  private handleDuplicateKeyError(error: unknown): void {
    const dbError = error as {
      code?: string;
      errno?: number;
      message?: string;
    };

    if (
      dbError?.code === MYSQL_ER_DUP_ENTRY ||
      dbError?.errno === MYSQL_ERRNO_DUP_ENTRY
    ) {
      if (
        dbError?.message?.includes('users.IDX_97672ac88f789774dd47f7c8be') ||
        dbError?.message?.includes('email')
      ) {
        throw new ConflictException(
          translateWithContext(this.i18n, 'errors.USER_EMAIL_TAKEN'),
        );
      }
      if (
        dbError?.message?.includes('users.IDX_fe0bb3f6520ee0469504521e71') ||
        dbError?.message?.includes('username')
      ) {
        throw new ConflictException(
          translateWithContext(this.i18n, 'errors.USER_USERNAME_TAKEN'),
        );
      }
      throw new ConflictException(
        translateWithContext(this.i18n, 'errors.USER_ALREADY_EXISTS'),
      );
    }
  }
}
