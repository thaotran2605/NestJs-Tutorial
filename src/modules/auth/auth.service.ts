import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service.js';
import { User } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { LoginCredentialsDto } from './dto/login.dto.js';
import { CreateUserDto } from './dto/register.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { JwtPayload } from './strategies/jwt.strategy.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async register(dto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.usersService.createUser(dto);
    const token = await this.generateToken(user);
    return this.formatUserResponse(user, token);
  }

  async login(dto: LoginCredentialsDto): Promise<UserResponseDto> {
    const user = await this.usersService.validateCredentials(
      dto.email,
      dto.password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = await this.generateToken(user);
    return this.formatUserResponse(user, token);
  }

  async logout(token: string | null): Promise<{ message: string }> {
    if (!token) {
      return { message: 'Logged out successfully' };
    }

    const decoded = this.jwtService.decode(token) as JwtPayload | null;
    if (decoded && decoded.jti && decoded.exp) {
      const currentTime = Math.floor(Date.now() / 1000);
      const remainingSeconds = decoded.exp - currentTime;
      if (remainingSeconds > 0) {
        await this.redisService.addTokenToBlacklist(decoded.jti, remainingSeconds);
      }
    }

    return { message: 'Logged out successfully' };
  }

  getCurrentUser(user: User, token: string): UserResponseDto {
    return this.formatUserResponse(user, token);
  }

  private async generateToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      jti: randomUUID(),
    };
    return this.jwtService.signAsync(payload);
  }

  private formatUserResponse(user: User, token: string): UserResponseDto {
    return {
      user: {
        email: user.email,
        token,
        username: user.username,
        bio: user.bio,
        image: user.image,
      },
    };
  }
}
