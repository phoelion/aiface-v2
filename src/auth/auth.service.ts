import { BadRequestException, NotFoundException, InternalServerErrorException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomInt } from 'crypto';
import { UsersService } from 'src/users/users.service';
import { User, UserDocument } from 'src/users/schema/user.schema';
import { ConfigService } from '@nestjs/config';
import * as moment from 'moment';
import { NotificationService } from 'src/notification/notification.service';
import { MessagesEnum } from 'src/notification/enums/messages.enum';
import { getCountryFromRequest } from 'src/shared/utils/ge-ip-info';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private userService: UsersService,
    private configService: ConfigService,
    private notificationService: NotificationService
  ) {}

  private genCode(expirationMinutes: number) {
    return {
      code: randomInt(1000, 9999),
      expires: Date.now() + expirationMinutes * 60 * 1000,
    };
  }

  private generateToken(userId: string, expires: any, role?: string) {
    const payload = {
      _id: userId,
      role,
      iat: moment().unix(),
      exp: expires.unix(),
    };

    return this.jwtService.signAsync(payload);
  }

  async generateAuthToken(user: Partial<UserDocument>) {
    const tokenExpires = moment().add(this.configService.get<string>('jwtExpTime'), 'days');
    const token = await this.generateToken(user.id, tokenExpires, user.role);

    return { token, expires: tokenExpires.toDate() };
  }

  async signup({ username, appAccountToken }, ip) {
    const country = await getCountryFromRequest(ip);
    const user = await this.userService.findOne({ username });
    const rand = Math.random() > 0.5 ? 1 : 0;

    if (!user) {
      const newUser = await this.userService.create({
        username,
        appAccountToken,
      });

      const token = await this.generateAuthToken(newUser);
      newUser.token = token;

      await newUser.save();
      await this.notificationService.sendNotification(MessagesEnum.NEW_USER.replace('{{id}}', newUser._id).replace('{{country}}', country));
      return {
        user: newUser,
      };
    }
    //
    const token = await this.generateAuthToken(user);
    user.token = token;
    await this.notificationService.sendNotification(MessagesEnum.PREV_USER.replace('{{id}}', user._id).replace('{{country}}', country));

    await user.save();

    return {
      user,
    };
  }
}
