import { Body, Controller, Get, Patch } from '@nestjs/common';
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

  @Patch('me')
  updateMe(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.users.updateMe(user, dto);
  }
}
