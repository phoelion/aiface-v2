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
    const newData = allTemplates[4].resourceList;

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

      const resizeDim = 340;
      const screenShotName = crypto.randomUUID() + '.jpeg';

      const screenShot = await takeFirstFrameScreenshot(newVideoPath, outputDir, screenShotName);

      const resizedImage = await compressImage(outputDir + '/' + screenShot, outputDir, screenShotName, resizeDim);

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
  async addPreviousImageTemplates() {
    // const data = [
    //   {
    //     categoryTemplates: [
    //       {
    //         tempId: '351',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-351.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-351.png',
    //       },
    //       {
    //         tempId: '352',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-352.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-352.png',
    //       },
    //       {
    //         tempId: '353',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-353.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-353.png',
    //       },
    //       {
    //         tempId: '354',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-354.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-354.png',
    //       },
    //       {
    //         tempId: '355',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-355.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-355.png',
    //       },
    //       {
    //         tempId: '356',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-356.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-356.png',
    //       },
    //       {
    //         tempId: '357',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-357.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-357.png',
    //       },
    //       {
    //         tempId: '358',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-358.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-358.png',
    //       },
    //       {
    //         tempId: '359',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-359.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-359.png',
    //       },
    //       {
    //         tempId: '360',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-360.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-360.png',
    //       },
    //       {
    //         tempId: '361',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-361.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-361.png',
    //       },
    //       {
    //         tempId: '362',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-362.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-362.png',
    //       },
    //       {
    //         tempId: '363',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-363.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-363.png',
    //       },
    //       {
    //         tempId: '364',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-364.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-364.png',
    //       },
    //       {
    //         tempId: '365',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-365.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-365.png',
    //       },
    //       {
    //         tempId: '366',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-366.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-366.png',
    //       },
    //       {
    //         tempId: '367',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-367.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-367.png',
    //       },
    //     ],
    //     sortOrder: 16,
    //     category: 'Spring 🌿',
    //   },
    //   {
    //     categoryTemplates: [
    //       {
    //         tempId: '320',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-320.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-320.png',
    //       },
    //       {
    //         tempId: '321',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-321.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-321.png',
    //       },
    //       {
    //         tempId: '322',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-322.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-322.png',
    //       },
    //       {
    //         tempId: '323',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-323.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-323.png',
    //       },
    //       {
    //         tempId: '324',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-324.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-324.png',
    //       },
    //       {
    //         tempId: '325',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-325.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-325.png',
    //       },
    //       {
    //         tempId: '326',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-326.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-326.png',
    //       },
    //       {
    //         tempId: '327',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-327.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-327.png',
    //       },
    //       {
    //         tempId: '328',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-328.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-328.png',
    //       },
    //       {
    //         tempId: '329',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-329.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-329.png',
    //       },
    //       {
    //         tempId: '330',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-330.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-330.png',
    //       },
    //       {
    //         tempId: '331',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-331.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-331.png',
    //       },
    //       {
    //         tempId: '332',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-332.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-332.png',
    //       },
    //     ],
    //     sortOrder: 14,
    //     category: 'Baby 👼🏻',
    //   },
    //   {
    //     categoryTemplates: [
    //       {
    //         tempId: '208',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-208.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-208.png',
    //       },
    //       {
    //         tempId: '209',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-209.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-209.png',
    //       },
    //       {
    //         tempId: '210',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-210.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-210.png',
    //       },
    //       {
    //         tempId: '211',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-211.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-211.png',
    //       },
    //       {
    //         tempId: '212',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-212.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-212.png',
    //       },
    //       {
    //         tempId: '213',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-213.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-213.png',
    //       },
    //       {
    //         tempId: '214',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-214.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-214.png',
    //       },
    //       {
    //         tempId: '215',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-215.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-215.png',
    //       },
    //       {
    //         tempId: '216',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-216.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-216.png',
    //       },
    //       {
    //         tempId: '217',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-217.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-217.png',
    //       },
    //       {
    //         tempId: '218',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-218.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-218.png',
    //       },
    //       {
    //         tempId: '219',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-219.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-219.png',
    //       },
    //       {
    //         tempId: '220',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-220.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-220.png',
    //       },
    //       {
    //         tempId: '221',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-221.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-221.png',
    //       },
    //       {
    //         tempId: '222',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-222.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-222.png',
    //       },
    //     ],
    //     sortOrder: 12,
    //     category: 'Professional Headshot',
    //   },
    //   {
    //     categoryTemplates: [
    //       {
    //         tempId: '138',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-138.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-138.png',
    //       },
    //       {
    //         tempId: '139',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-139.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-139.png',
    //       },
    //       {
    //         tempId: '140',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-140.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-140.png',
    //       },
    //       {
    //         tempId: '141',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-141.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-141.png',
    //       },
    //       {
    //         tempId: '142',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-142.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-142.png',
    //       },
    //       {
    //         tempId: '143',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-143.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-143.png',
    //       },
    //       {
    //         tempId: '144',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-144.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-144.png',
    //       },
    //       {
    //         tempId: '145',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-145.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-145.png',
    //       },
    //       {
    //         tempId: '146',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-146.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-146.png',
    //       },
    //       {
    //         tempId: '147',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-147.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-147.png',
    //       },
    //       {
    //         tempId: '148',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-148.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-148.png',
    //       },
    //       {
    //         tempId: '149',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-149.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-149.png',
    //       },
    //       {
    //         tempId: '150',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-150.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-150.png',
    //       },
    //     ],
    //     sortOrder: 11,
    //     category: 'Modeling',
    //   },
    //   {
    //     categoryTemplates: [
    //       {
    //         tempId: '112',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-112.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-112.png',
    //       },
    //       {
    //         tempId: '113',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-113.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-113.png',
    //       },
    //       {
    //         tempId: '114',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-114.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-114.png',
    //       },
    //       {
    //         tempId: '115',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-115.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-115.png',
    //       },
    //       {
    //         tempId: '116',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-116.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-116.png',
    //       },
    //       {
    //         tempId: '117',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-117.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-117.png',
    //       },
    //       {
    //         tempId: '118',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-118.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-118.png',
    //       },
    //       {
    //         tempId: '119',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-119.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-119.png',
    //       },
    //       {
    //         tempId: '120',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-120.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-120.png',
    //       },
    //       {
    //         tempId: '121',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-121.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-121.png',
    //       },
    //       {
    //         tempId: '122',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-122.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-122.png',
    //       },
    //       {
    //         tempId: '123',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-123.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-123.png',
    //       },
    //       {
    //         tempId: '124',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-124.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-124.png',
    //       },
    //       {
    //         tempId: '125',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-125.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-125.png',
    //       },
    //       {
    //         tempId: '126',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-126.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-126.png',
    //       },
    //       {
    //         tempId: '127',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-127.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-127.png',
    //       },
    //     ],
    //     sortOrder: 10,
    //     category: 'Bride 👰‍♀️',
    //   },
    //   {
    //     categoryTemplates: [
    //       {
    //         tempId: '189',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-189.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-189.png',
    //       },
    //       {
    //         tempId: '190',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-190.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-190.png',
    //       },
    //       {
    //         tempId: '191',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-191.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-191.png',
    //       },
    //       {
    //         tempId: '192',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-192.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-192.png',
    //       },
    //       {
    //         tempId: '193',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-193.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-193.png',
    //       },
    //       {
    //         tempId: '194',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-194.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-194.png',
    //       },
    //       {
    //         tempId: '195',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-195.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-195.png',
    //       },
    //       {
    //         tempId: '196',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-196.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-196.png',
    //       },
    //       {
    //         tempId: '197',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-197.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-197.png',
    //       },
    //       {
    //         tempId: '198',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-198.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-198.png',
    //       },
    //       {
    //         tempId: '199',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-199.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-199.png',
    //       },
    //       {
    //         tempId: '200',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-200.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-200.png',
    //       },
    //     ],
    //     sortOrder: 9,
    //     category: 'Ai Face',
    //   },
    //   {
    //     categoryTemplates: [
    //       {
    //         tempId: '151',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-151.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-151.png',
    //       },
    //       {
    //         tempId: '152',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-152.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-152.png',
    //       },
    //       {
    //         tempId: '153',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-153.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-153.png',
    //       },
    //       {
    //         tempId: '154',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-154.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-154.png',
    //       },
    //       {
    //         tempId: '155',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-155.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-155.png',
    //       },
    //       {
    //         tempId: '156',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-156.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-156.png',
    //       },
    //       {
    //         tempId: '157',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-157.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-157.png',
    //       },
    //       {
    //         tempId: '158',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-158.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-158.png',
    //       },
    //       {
    //         tempId: '159',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-159.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-159.png',
    //       },
    //       {
    //         tempId: '160',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-160.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-160.png',
    //       },
    //       {
    //         tempId: '161',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-161.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-161.png',
    //       },
    //       {
    //         tempId: '162',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-162.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-162.png',
    //       },
    //       {
    //         tempId: '163',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-163.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-163.png',
    //       },
    //       {
    //         tempId: '164',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-164.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-164.png',
    //       },
    //       {
    //         tempId: '165',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-165.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-165.png',
    //       },
    //       {
    //         tempId: '166',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-166.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-166.png',
    //       },
    //       {
    //         tempId: '167',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-167.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-167.png',
    //       },
    //       {
    //         tempId: '168',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-168.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-168.png',
    //       },
    //       {
    //         tempId: '169',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-169.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-169.png',
    //       },
    //       {
    //         tempId: '170',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-170.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-170.png',
    //       },
    //     ],
    //     sortOrder: 7,
    //     category: 'Movie 📽️',
    //   },
    //   {
    //     categoryTemplates: [
    //       {
    //         tempId: '181',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-181.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-181.png',
    //       },
    //       {
    //         tempId: '182',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-182.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-182.png',
    //       },
    //       {
    //         tempId: '183',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-183.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-183.png',
    //       },
    //       {
    //         tempId: '184',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-184.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-184.png',
    //       },
    //       {
    //         tempId: '185',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-185.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-185.png',
    //       },
    //       {
    //         tempId: '186',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-186.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-186.png',
    //       },
    //       {
    //         tempId: '187',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-187.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-187.png',
    //       },
    //       {
    //         tempId: '188',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-188.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-188.png',
    //       },
    //     ],
    //     sortOrder: 6,
    //     category: 'Disney Character',
    //   },
    //   {
    //     categoryTemplates: [
    //       {
    //         tempId: '256',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-256.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-256.png',
    //       },
    //       {
    //         tempId: '257',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-257.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-257.png',
    //       },
    //       {
    //         tempId: '258',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-258.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-258.png',
    //       },
    //       {
    //         tempId: '259',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-259.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-259.png',
    //       },
    //       {
    //         tempId: '260',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-260.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-260.png',
    //       },
    //       {
    //         tempId: '261',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-261.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-261.png',
    //       },
    //       {
    //         tempId: '262',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-262.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-262.png',
    //       },
    //       {
    //         tempId: '263',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-263.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-263.png',
    //       },
    //       {
    //         tempId: '264',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-264.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-264.png',
    //       },
    //       {
    //         tempId: '265',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-265.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-265.png',
    //       },
    //     ],
    //     sortOrder: 5,
    //     category: 'Water vibe 💦',
    //   },
    //   {
    //     categoryTemplates: [
    //       {
    //         tempId: '128',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-128.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-128.png',
    //       },
    //       {
    //         tempId: '129',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-129.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-129.png',
    //       },
    //       {
    //         tempId: '130',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-130.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-130.png',
    //       },
    //       {
    //         tempId: '131',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-131.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-131.png',
    //       },
    //       {
    //         tempId: '132',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-132.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-132.png',
    //       },
    //       {
    //         tempId: '133',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-133.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-133.png',
    //       },
    //       {
    //         tempId: '134',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-134.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-134.png',
    //       },
    //       {
    //         tempId: '135',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-135.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-135.png',
    //       },
    //       {
    //         tempId: '136',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-136.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-136.png',
    //       },
    //       {
    //         tempId: '137',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-137.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-137.png',
    //       },
    //     ],
    //     sortOrder: 3,
    //     category: 'Groom 🤵🏻‍♂️',
    //   },
    //   {
    //     categoryTemplates: [
    //       {
    //         tempId: '80',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-80.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-80.png',
    //       },
    //       {
    //         tempId: '81',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-81.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-81.png',
    //       },
    //       {
    //         tempId: '82',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-82.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-82.png',
    //       },
    //       {
    //         tempId: '83',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-83.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-83.png',
    //       },
    //       {
    //         tempId: '84',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-84.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-84.png',
    //       },
    //       {
    //         tempId: '85',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-85.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-85.png',
    //       },
    //       {
    //         tempId: '86',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-86.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-86.png',
    //       },
    //       {
    //         tempId: '87',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-87.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-87.png',
    //       },
    //       {
    //         tempId: '88',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-88.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-88.png',
    //       },
    //       {
    //         tempId: '89',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-89.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-89.png',
    //       },
    //       {
    //         tempId: '90',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-90.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-90.png',
    //       },
    //       {
    //         tempId: '91',
    //         cover: 'https://fancy.epicaiteam.com/aiface/templates/Cover-91.png',
    //         image: 'https://fancy.epicaiteam.com/aiface/templates/Cover-91.png',
    //       },
    //     ],
    //     sortOrder: 1,
    //     category: 'Asian',
    //   },
    // ];
    // for (let i = 0; i < data.length; i++) {
    //   const categoryDto: CreateCategoryDto = {
    //     name: data[i].category,
    //     isActive: true,
    //     sortOrder: i,
    //     type: CategoryTypeEnum.IMAGE,
    //   };
    //   const category = await this.createCategory(categoryDto);
    //   for (let j = 0; j < data[i].categoryTemplates.length; j++) {
    //     const templateDto: CreateTemplateDto = {
    //       sortOrder: j,
    //       isActive: true,
    //       isFree: false,
    //       categoryId: category,
    //       type: TemplateTypeEnum.IMAGE,
    //     };
    //     const template = await this.templateModel.create({
    //       thumbnail: `Cover-${data[i].categoryTemplates[j].tempId}.png`,
    //       categoryId: templateDto.categoryId,
    //       isActive: templateDto.isActive,
    //       isFree: templateDto.isFree,
    //       file: `Image-${data[i].categoryTemplates[j].tempId}.png`,
    //       sortOrder: templateDto.sortOrder,
    //       type: TemplateTypeEnum.IMAGE,
    //     });
    //     console.log(`[+] template ${template.file} created with category of ${category.name}`);
    //   }
    // }
  }
  async getTemplateWithDetails(templateId: string) {
    return this.templateModel.findById(templateId);
  }
}
