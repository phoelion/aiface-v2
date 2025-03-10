import { Controller, UseGuards, Body, Get, Post, Request } from '@nestjs/common';
import { ContactUsService } from './contact-us.service';
import { CreateContactUsDto } from './dtos/create-contact-us.dto';

import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('aiface/contact-us')
export class ContactUsController {
  constructor(private contactUsService: ContactUsService) {}


  @UseGuards(AuthGuard)
  @Post('/')
  async createContactUs(@Request() req: Request, @Body() createContactUsDto: CreateContactUsDto) {
    const contactUS = await this.contactUsService.create(req['user']._id, createContactUsDto);
    return {
      success: true,
      contactUS,
    };
  }

  @Roles('admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Get('/')
  async getAllContactUses() {
    const contactUses = await this.contactUsService.getAll();
    return {
      success: true,
      totalContactUses: contactUses.length,
      contactUses,
    };
  }
}
