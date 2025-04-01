import { Controller, UseGuards, Get, Body, Post, Req, BadRequestException, HttpCode } from '@nestjs/common';
import { UsersService } from './users.service';

import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from 'src/common/guards/auth.guard';

import { DevGuard } from 'src/common/guards/dev.guard';

import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { STATUS_CODES } from 'http';
import { RequestWithUser } from '../common/interfaces/request-with-user';

@ApiSecurity('x-api-key')
@ApiBearerAuth()
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly userService: UsersService,
    private readonly configService: ConfigService
  ) {}

  @UseGuards(AuthGuard, DevGuard)
  @Get('me')
  async getUser(@Req() req: RequestWithUser) {
    const user = await this.userService.getUser(req.user._id);
    return {
      success: true,
      user,
    };
  }

  @UseGuards(AuthGuard)
  @Post('/toggle-add-to-history')
  async toggleAddToHistory(@Req() req: RequestWithUser) {
    const user = await this.userService.toggleAddToHistory(req.user._id);
    return {
      success: true,
      user,
    };
  }
}
