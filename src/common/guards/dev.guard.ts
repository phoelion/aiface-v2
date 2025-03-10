import { CanActivate, forwardRef, Inject, ExecutionContext, Injectable, UnauthorizedException, HttpException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { Request } from 'express';

@Injectable()
export class DevGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-api-key'];
    if (!token || token !== this.configService.get<string>('X_API_KEY')) {
      throw new ForbiddenException();
    }
    return true;
  }
}
