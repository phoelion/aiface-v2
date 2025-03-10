import { Body, Controller, Get, Param, Post, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { HomeService } from './home.service';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { FileInterceptor } from '@nestjs/platform-express'
import { SetConfigDto } from './dtos/set-config.dto'
import { SetAppConstantsDto } from './dtos/set-app-constants.dto';
import { SetFeatureDto } from './dtos/set-feature.dto';
import { MULTER_OPTIONS_HOME } from 'src/config/app-constants';
import { ConfigService } from '@nestjs/config';

@Controller('home')
export class HomeController {
  constructor(
    private readonly homeService: HomeService,
    private readonly configService: ConfigService
  ) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Post('/upload-image')
  @UseInterceptors(FileInterceptor('image', MULTER_OPTIONS_HOME))
  async uploadImage(
    @Request() req: Request,

    @UploadedFile() image: Express.Multer.File
  ) {
    return {
      success: true,
      image: image.filename,
      imageUrl: this.configService.get<string>('baseUrl') + '/public' + '/home/' + image.filename,
    };
  }

  @Roles('admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Post()
  async setHomeConfigs(@Request() req: Request, @Body() setConfigDto: SetConfigDto) {
    const homeConfig = await this.homeService.setHomeConfigs(setConfigDto);
    return {
      success: true,
      homeConfig,
    };
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Post('/app-constants')
  async setAppConstants(@Request() req: Request, @Body() setAppConstantsDto: SetAppConstantsDto) {
    const homeConfig = await this.homeService.setAppConstants(setAppConstantsDto);
    return {
      success: true,
      homeConfig,
    };
  }
  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Post('/set-feature')
  async setFeature(@Request() req: Request, @Body() setFeatureDto: SetFeatureDto) {
    const feature = await this.homeService.setFeature(setFeatureDto);
    return {
      success: true,
      feature,
    };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get()
  async getHomeConfigs() {
    const homeConfig = await this.homeService.getHomeConfigs();

    return {
      success: true,
      homeConfig,
    };
  }
}
