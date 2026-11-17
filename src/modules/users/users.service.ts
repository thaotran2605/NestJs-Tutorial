import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { ATTACHMENT_ENTITY_TYPE_USER } from '../attachments/attachments.constants.js';
import {
  AttachmentsService,
  UploadedAvatarFile,
} from '../attachments/attachments.service.js';
import { BCRYPT_SALT_ROUNDS } from '../auth/auth.constants.js';
import { CreateUserDto } from '../auth/dto/register.dto.js';
import { UpdateUserDataDto } from './dto/update-user.dto.js';
import { User } from './entities/user.entity.js';

// Pre-computed bcrypt hash used to prevent timing attacks (user enumeration)
const DUMMY_HASH =
  '$2b$10$wTfI2zI6wZ0lYFk51Jz35.Q4H21O0yA/vQ2d2Y5c6F7v8u9w0x1y2';
const MYSQL_ER_DUP_ENTRY = 'ER_DUP_ENTRY';
const MYSQL_ERRNO_DUP_ENTRY = 1062;

export interface UpdateUserResult {
  user: User;
  isPasswordChanged: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  async createUser(dto: CreateUserDto): Promise<User> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedUsername = dto.username.trim();

    const existingEmail = await this.findByEmail(normalizedEmail);
    if (existingEmail) {
      throw new ConflictException('Email has already been taken');
    }

    const existingUsername = await this.findByUsername(normalizedUsername);
    if (existingUsername) {
      throw new ConflictException('Username has already been taken');
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    try {
      const user = this.userRepository.create({
        username: normalizedUsername,
        email: normalizedEmail,
        password: hashedPassword,
      });

      return await this.userRepository.save(user);
    } catch (error: any) {
      this.handleDuplicateKeyError(error);
      throw error;
    }
  }

  async updateUser(
    currentUser: User,
    dto: UpdateUserDataDto,
    avatarFile?: UploadedAvatarFile,
  ): Promise<UpdateUserResult> {
    if (dto.email !== undefined) {
      const normalizedEmail = dto.email.trim().toLowerCase();
      if (normalizedEmail !== currentUser.email) {
        const existingEmail = await this.findByEmail(normalizedEmail);
        if (existingEmail && existingEmail.id !== currentUser.id) {
          throw new ConflictException('Email has already been taken');
        }
        currentUser.email = normalizedEmail;
      }
    }

    if (dto.username !== undefined) {
      const normalizedUsername = dto.username.trim();
      if (normalizedUsername !== currentUser.username) {
        const existingUsername = await this.findByUsername(normalizedUsername);
        if (existingUsername && existingUsername.id !== currentUser.id) {
          throw new ConflictException('Username has already been taken');
        }
        currentUser.username = normalizedUsername;
      }
    }

    let isPasswordChanged = false;
    if (dto.password !== undefined) {
      currentUser.password = await bcrypt.hash(
        dto.password,
        BCRYPT_SALT_ROUNDS,
      );
      isPasswordChanged = true;
    }

    if (dto.bio !== undefined) {
      currentUser.bio = dto.bio;
    }

    if (avatarFile) {
      const attachment = await this.attachmentsService.saveEntityAvatar(
        ATTACHMENT_ENTITY_TYPE_USER,
        currentUser.id,
        avatarFile,
      );
      currentUser.image = attachment.url;
    } else if (dto.image !== undefined) {
      currentUser.image = dto.image;
    }

    try {
      const savedUser = await this.userRepository.save(currentUser);
      return {
        user: savedUser,
        isPasswordChanged,
      };
    } catch (error: any) {
      this.handleDuplicateKeyError(error);
      throw error;
    }
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

  private handleDuplicateKeyError(error: any): void {
    if (
      error?.code === MYSQL_ER_DUP_ENTRY ||
      error?.errno === MYSQL_ERRNO_DUP_ENTRY
    ) {
      if (
        error?.message?.includes('users.IDX_97672ac88f789774dd47f7c8be') ||
        error?.message?.includes('email')
      ) {
        throw new ConflictException('Email has already been taken');
      }
      if (
        error?.message?.includes('users.IDX_fe0bb3f6520ee0469504521e71') ||
        error?.message?.includes('username')
      ) {
        throw new ConflictException('Username has already been taken');
      }
      throw new ConflictException('User already exists');
    }
  }
}
