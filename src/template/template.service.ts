import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Template, TemplateDocument } from './model/templates.schema';
import { Categories } from './model/category.enum';

import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { compressImage, createLowResTemplate, createThumbnail, takeFirstFrameScreenshot } from '../shared/utils/file.service';
import { Category } from './model/category.schema';
import { CreateTemplateDto } from './dtos/create-template.dto';
import { TemplateTypeEnum } from './enums/template-type.enum';
import { CreateCategoryDto } from './dtos/create-category.dto';
import * as crypto from 'node:crypto';
import { VIDEO_TEMPLATES_POSTFIX } from '../config/app-constants';
import { CategoryTypeEnum } from './enums/category-type.enum';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { access } from 'node:fs/promises';
import { downloadFile } from 'src/shared/utils/downloader';
import getVideoDurationInSeconds from 'get-video-duration';

@Injectable()
export class TemplateService {
  constructor(
    @InjectModel(Template.name) private templateModel: Model<Template>,
    @InjectModel(Category.name) private categoryModel: Model<Category>,
    private userService: UsersService,
    private readonly configService: ConfigService
  ) {}

  async createPhotoTemplate(data: CreateTemplateDto, image: Express.Multer.File) {
    const category = await this.categoryModel.findById(data.categoryId);
    if (!category || category.type !== CategoryTypeEnum.IMAGE) {
      throw new BadRequestException('Category not found');
    }
    const resizeDim = 340;
    const resizedImage = await compressImage(image.path, image.destination, image.filename, resizeDim);

    return this.templateModel.create({
      thumbnail: resizedImage,
      categoryId: data.categoryId,
      isActive: data.isActive,
      isFree: data.isFree,
      file: image.filename,
      sortOrder: data.sortOrder,
      type: TemplateTypeEnum.IMAGE,
    });
  }

  async createVideoTemplate(data: CreateTemplateDto, video: Express.Multer.File) {
    const category = await this.categoryModel.findById(data.categoryId);
    if (!category || category.type !== CategoryTypeEnum.VIDEO) {
      throw new BadRequestException('Category not found');
    }
    const resizeDim = 340;
    const screenShotName = crypto.randomUUID() + '.jpeg';
    const screenShot = await takeFirstFrameScreenshot(video.path, video.destination, screenShotName);

    const resizedImage = await compressImage(video.destination + '/' + screenShot, video.destination, screenShotName, resizeDim);

    const lowResWebpName = video.filename.split('.')[0] + VIDEO_TEMPLATES_POSTFIX;

    await createLowResTemplate(video.path, video.destination, lowResWebpName);
    return this.templateModel.create({
      thumbnail: resizedImage,
      categoryId: data.categoryId,
      isActive: data.isActive,
      isFree: data.isFree,
      file: video.filename,
      sortOrder: data.sortOrder,
      type: TemplateTypeEnum.VIDEO,
    });
  }

  public async createCategory(data: CreateCategoryDto) {
    return await this.categoryModel.create({
      isActive: data.isActive,
      name: data.name,
      sortOrder: data.sortOrder,
      type: data.type,
    });
  }

  async getLastTempId(): Promise<number> {
    const lastTempIdDocument = await this.templateModel.aggregate([
      {
        $addFields: {
          tempIdAsInt: { $toInt: '$tempId' },
        },
      },
      {
        $sort: { tempIdAsInt: -1 },
      },
      {
        $limit: 1,
      },
      {
        $project: {
          tempIdAsInt: 0,
        },
      },
    ]);
    return Number(lastTempIdDocument[0].tempId);
  }

  async updateMultiTemplates(conditions, data: Partial<TemplateDocument>): Promise<void> {
    await this.templateModel.updateMany(conditions, data, { new: true });
  }

  async findAllTemplates() {
    return this.templateModel
      .find({
        category: { $eq: null },
      })
      .sort({ cover: -1 });
  }

  async updateTemplates(category: Categories, newName: Categories) {
    return this.templateModel.updateMany({ category }, { category: newName });
  }

  async findTemplateByName(tempId: string) {
    return this.templateModel.find({ tempId });
  }

  async findTemplateById(id: string) {
    return this.templateModel.findById(id);
  }

  async getAllCategories(type: CategoryTypeEnum) {
    return this.categoryModel.find({
      isActive: true,
      type,
    });
  }

  async getCategoryTemplates(id: string) {
    return this.templateModel.find({ categoryId: id });
  }

  async updateSortOrder(categoryCounts) {
    for (let category of Object.keys(categoryCounts)) {
      await this.templateModel.updateMany({ category }, { sortOrder: categoryCounts[category] });
    }
  }

  async createMultiImageLess(startTempId: number, endTempId: number, category: string) {
    const lastSortOrder = await this.templateModel.find().sort({ createdAt: -1 }).limit(1);
    for (let i = startTempId; i <= endTempId; i++) {
      await this.templateModel.create({
        thumbnail: `Image-${i}.png`,
        cover: `Cover-${i}.png`,
        tempId: i.toString(),
        isActive: true,
        isEventTemplate: false,
        sortOrder: lastSortOrder[0].sortOrder + 1,
        category,
      });
    }
  }
  private async checkFileExists(filePath: string) {
    try {
      await access(filePath);
      return true;
    } catch (err) {
      return false;
    }
  }

  async createMultiVideoTemplates() {
    const categoryIds = (await this.categoryModel.find({ _id: { $ne: '674b39e013c6482b4f3112fa' }, type: TemplateTypeEnum.VIDEO }).select('_id')).map((el) => el._id);
    const allTemplates = JSON.parse(readFileSync(join(__dirname, '..', '..', 'data', 'mivo.json'), 'utf-8'));
    const newData = allTemplates[4].resourceList.slice(0, 4);

    for (let template of newData) {
      const newVideoName = crypto.randomUUID() + '.mp4';
      const originalTemplateName = template.videoPreviewUrl.split('/').at(-1);
      const videoPath = join(__dirname, '..', '..', 'public', 'templates', 'video', originalTemplateName);
      const newVideoPath = join(__dirname, '..', '..', 'public', 'templates', 'video', newVideoName);

      const fileExists = await this.checkFileExists(videoPath);
      if (!fileExists) {
        Logger.log(`[+] Downloading: ${originalTemplateName}`);
        try {
          await downloadFile(template.videoPreviewUrl, newVideoPath);
        } catch (error) {
          console.log(error);
        }
      }
      const outputDir = join(__dirname, '..', '..', 'public', 'templates', 'video');
      const pureTemplateName = newVideoName.split('.')[0];
      const thumbnailPath = join(__dirname, '..', '..', 'public', 'templates', 'video', `${pureTemplateName}-thumbnail.png`);
      const thumbnailRes = await createThumbnail(newVideoPath, outputDir, pureTemplateName);
      const resizedImage = await compressImage(thumbnailPath, outputDir, pureTemplateName);

      const lowResWebpName = pureTemplateName + VIDEO_TEMPLATES_POSTFIX;

      await createLowResTemplate(newVideoPath, outputDir, lowResWebpName);

      const duration = Math.ceil(await getVideoDurationInSeconds(newVideoPath));

      await this.templateModel.create({
        thumbnail: resizedImage,
        categoryId: categoryIds[Math.ceil(Math.random() * categoryIds.length) - 1],
        isActive: true,
        isFree: false,
        file: newVideoName,
        sortOrder: 1,
        type: TemplateTypeEnum.VIDEO,
        durationSec: duration,
      });

      Logger.log(template.id);
    }
  }
}
