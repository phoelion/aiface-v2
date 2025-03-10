import { Controller, Body, Post, UseGuards, Req } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { DevGuard } from 'src/common/guards/dev.guard';
import { SignupDto } from './dtos/signup.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService
  ) {}

  @ApiSecurity('x-api-key')
  @UseGuards(DevGuard)
  @Post('/signup')

  async signup(@Req() req: Request, @Body() signupDto: SignupDto) {
    const ip = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : '127.0.0.1';
    const { user } = await this.authService.signup(signupDto, ip);
    return {
      success: true,
      user,
    };
  }

}
