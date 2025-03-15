import { BadRequestException, Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Template, TemplateDocument } from './model/templates.schema';
import { Categories } from './model/category.enum';

import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { compressImage, createLowResTemplate, takeFirstFrameScreenshot } from '../shared/utils/file.service';
import { Category } from './model/category.schema';
import { CreateTemplateDto } from './dtos/create-template.dto';
import { TemplateTypeEnum } from './enums/template-type.enum';
import { CreateCategoryDto } from './dtos/create-category.dto';
import * as crypto from 'node:crypto';
import { VIDEO_TEMPLATES_POSTFIX } from '../config/app-constants';
import { CategoryTypeEnum } from './enums/category-type.enum';

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
    console.log(screenShot);
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

  // async updateMultiTemplatesV2() {
  //   const data = await this.templateModel.find({ category: Categories.Event });
  //
  //   for (let doc of data) {
  //     doc.thumbnail = `Image-${doc.tempId}.png`;
  //     doc.cover = `Image-${doc.tempId}.png`;
  //     await doc.save({});
  //   }
  //
  //   console.log(data.length);
  // }

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

  async findTemplateById(tempId: string) {
    return this.templateModel.findOne({ tempId });
  }

  async getAllCategories(type: CategoryTypeEnum) {
    return this.categoryModel.find({
      isActive: true,
      type,
    });
  }

  // async getCategoriesTemplates() {
  //   const mainCategories = Object.values(Categories).filter((category) => category !== Categories.Event);
  //
  //   const categories = await this.templateModel.aggregate([
  //     {
  //       $match: {
  //         $and: [{ category: { $ne: null } }, { category: { $in: mainCategories } }],
  //       },
  //     },
  //     {
  //       $group: {
  //         _id: '$category',
  //         categoryTemplates: {
  //           $push: {
  //             tempId: '$tempId',
  //             sortOder: '$sortOrder',
  //             cover: {
  //               $concat: [`${this.configService.get<string>('HTTPS_BASE_URL')}/templates/`, '$cover'],
  //             },
  //             image: {
  //               $concat: [`${this.configService.get<string>('HTTPS_BASE_URL')}/templates/`, '$cover'],
  //             },
  //           },
  //         },
  //         sortOrder: {
  //           $first: '$sortOrder',
  //         },
  //       },
  //     },
  //     { $addFields: { category: '$_id' } },
  //
  //     { $project: { _id: 0, 'categoryTemplates.sortOder': 0 } },
  //   ]);
  //
  //   const fixedData = categories.map((el) => {
  //     return { ...el, category: el.category.replace(/([A-Z])/g, ' $1').trim() };
  //   });
  //
  //   const sortedData = fixedData.sort((a, b) => b.sortOrder - a.sortOrder);
  //
  //   return sortedData;
  // }

  // async swapsReport(totalImageSwaps, totalVideoSwaps) {
  //   const totalSuccessfulImageSwaps = totalImageSwaps.filter((el) => el.status === 'success').length;
  //   const totalSuccessfulVideoSwaps = totalVideoSwaps.filter((el) => el.status === 'success' || el.resultVideo?.length > 0).length;
  //   const totalFailedVideoSwaps = totalVideoSwaps.filter((el) => el.status === 'failed' || el.resultVideo?.length > 0).length;
  //
  //   const templateIds = totalImageSwaps.map((el) => el.jobId);
  //
  //   const templates = await this.templateModel
  //     .find({
  //       tempId: { $in: templateIds },
  //     })
  //     .exec();
  //   const eventTempIdsRange = (await this.templateModel.find({ category: 'Event' }).select('tempId')).map((el) => el.tempId).sort();
  //
  //   const eventSwapsCount = templates.filter((el) => el.category === Categories.Event).length;
  //   const normalSwapsCount = totalImageSwaps.filter((el) => el.jobId === 'normalFaceSwap').length;
  //
  //   const templateIdToCategory = templates.reduce((acc, template) => {
  //     acc[template.tempId] = template.category;
  //     return acc;
  //   }, {});
  //
  //   const categoryCounts = templateIds.reduce((acc, id) => {
  //     const category = templateIdToCategory[id];
  //     if (category) {
  //       acc[category] = (acc[category] || 0) + 1;
  //     }
  //     return acc;
  //   }, {});
  //
  //   const templateCounts = templateIds.reduce((acc, id) => {
  //     acc[id] = (acc[id] || 0) + 1;
  //     return acc;
  //   }, {});
  //
  //   delete templateCounts['normalFaceSwap'];
  //   const topCategories = Object.entries(categoryCounts)
  //     .sort(([, a], [, b]) => Number(b) - Number(a))
  //     .slice(0, 3)
  //     .reduce((acc, [key, value]) => {
  //       acc[key] = value;
  //       return acc;
  //     }, {});
  //
  //   const topTemplates = Object.entries(templateCounts)
  //     .sort(([, a], [, b]) => Number(b) - Number(a))
  //     .slice(0, 3)
  //     .reduce((acc, [key, value]) => {
  //       acc[key] = value;
  //       return acc;
  //     }, {});
  //
  //   const tempImages = await this.templateModel.find({ tempId: { $in: Object.keys(topTemplates) } });
  //
  //   return {
  //     categoryCounts,
  //     eventSwapsCount,
  //     aiFaceSwapCount: totalImageSwaps.length - normalSwapsCount - eventSwapsCount,
  //     normalSwapsCount,
  //     totalImageSwaps: totalImageSwaps.length,
  //     topTemplates,
  //     topCategories,
  //     totalSuccessfulImageSwaps,
  //     totalFailedImageSwaps: totalImageSwaps.length - totalSuccessfulImageSwaps,
  //     totalSuccessfulVideoSwaps,
  //     totalFailedVideoSwaps: totalFailedVideoSwaps.length,
  //   };
  // }

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
}
