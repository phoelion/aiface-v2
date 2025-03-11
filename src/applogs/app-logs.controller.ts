import { Controller, Post, Req, Res, UseGuards, Body } from '@nestjs/common';
import { Request, Response } from 'express';
import { LogsService } from './app-logs.service';

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RequestWithUser } from '../common/interfaces/request-with-user';


@Controller('logs')
@ApiTags('logs')
export class LogsController {
  constructor(private readonly logService: LogsService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post('/')
  addFavorites(@Req() req: RequestWithUser, @Res() res: Response, @Body() body) {
    const ip = req.get('x-forwarded-for') || '';
    const userAgent = req.get('user-agent') || '';
    const data = this.logService.createLog(req.user._id, body, { userAgent, ip });

    return res.json({
      success: true,
      message: 'log saved',
    });
  }
}
