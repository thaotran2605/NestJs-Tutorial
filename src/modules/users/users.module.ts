import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttachmentsModule } from '../attachments/attachments.module.js';
import { TokenModule } from '../auth/token.module.js';
import { User } from './entities/user.entity.js';
import { UserController } from './user.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([User]), AttachmentsModule, TokenModule],
  controllers: [UserController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
