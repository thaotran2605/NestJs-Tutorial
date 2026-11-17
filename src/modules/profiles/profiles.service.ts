import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { ProfileResponseDto } from './dto/profile-response.dto.js';
import { Follow } from './entities/follow.entity.js';

const MYSQL_ER_DUP_ENTRY = 'ER_DUP_ENTRY';
const MYSQL_ERRNO_DUP_ENTRY = 1062;

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    private readonly usersService: UsersService,
  ) {}

  async getProfile(
    targetUsername: string,
    currentUser?: User | null,
  ): Promise<ProfileResponseDto> {
    const targetUser = await this.findTargetUserOrThrow(targetUsername);

    let isFollowing = false;
    if (currentUser && currentUser.id !== targetUser.id) {
      const followRecord = await this.followRepository.findOne({
        where: {
          followerId: currentUser.id,
          followingId: targetUser.id,
        },
      });
      isFollowing = Boolean(followRecord);
    }

    return this.buildProfileResponse(targetUser, isFollowing);
  }

  async followUser(
    targetUsername: string,
    currentUser: User,
  ): Promise<ProfileResponseDto> {
    const targetUser = await this.findTargetUserOrThrow(targetUsername);

    if (targetUser.id === currentUser.id) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const existingFollow = await this.followRepository.findOne({
      where: {
        followerId: currentUser.id,
        followingId: targetUser.id,
      },
    });

    if (!existingFollow) {
      try {
        const follow = this.followRepository.create({
          followerId: currentUser.id,
          followingId: targetUser.id,
        });
        await this.followRepository.save(follow);
      } catch (error: any) {
        if (
          error?.code !== MYSQL_ER_DUP_ENTRY &&
          error?.errno !== MYSQL_ERRNO_DUP_ENTRY
        ) {
          throw error;
        }
      }
    }

    return this.buildProfileResponse(targetUser, true);
  }

  async unfollowUser(
    targetUsername: string,
    currentUser: User,
  ): Promise<ProfileResponseDto> {
    const targetUser = await this.findTargetUserOrThrow(targetUsername);

    if (targetUser.id === currentUser.id) {
      throw new BadRequestException('You cannot unfollow yourself');
    }

    await this.followRepository.delete({
      followerId: currentUser.id,
      followingId: targetUser.id,
    });

    return this.buildProfileResponse(targetUser, false);
  }

  private async findTargetUserOrThrow(username: string): Promise<User> {
    const targetUser = await this.usersService.findByUsername(username);
    if (!targetUser) {
      throw new NotFoundException('Profile not found');
    }
    return targetUser;
  }

  private buildProfileResponse(
    user: User,
    isFollowing: boolean,
  ): ProfileResponseDto {
    return {
      profile: {
        username: user.username,
        bio: user.bio,
        image: user.image,
        following: isFollowing,
      },
    };
  }
}
