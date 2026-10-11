import { Body, Controller, Get, Param, ParseIntPipe, Patch } from '@nestjs/common';
import type { User } from '@prisma/client';
import { UpdateProfileDto } from '../auth/dto/auth.dto';
import { CurrentUser } from '../common/decorators';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: User) {
    return this.users.getMe(user);
  }

  /** Public profile card (tap on a wall username → private chat). */
  @Get(':id/profile')
  getPublicProfile(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.users.getPublicProfile(user, id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.users.updateMe(user, dto);
  }
}
