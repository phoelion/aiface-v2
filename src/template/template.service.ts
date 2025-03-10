import { Inject, Injectable, InternalServerErrorException, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Template, TemplateDocument } from './model/templates.schema';
import { UserService } from 'src/users/users.service';
import { User } from 'src/users/model/user.schema';
import CreateMultiTemplatesDto from './dtos/createMultiTemplate.dto';
import { Categories } from './model/category.enum';
import * as unzipper from 'unzipper';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as sharp from 'sharp';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class TemplateService {
  constructor(
    @InjectModel(Template.name) private templateModel: Model<Template>,

    private userService: UserService,
    private readonly configService: ConfigService
  ) {}

  async createTemplate(data: Partial<Template>) {
    return this.templateModel.create(data);
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
  async createMultiTemplates(zipFilePath: string, destinationFolder: string, category: Categories): Promise<{ templateIds: string[]; imageNames: string[] }> {
    try {
      const maxSortOrder = await this.templateModel.aggregate([
        {
          $group: {
            _id: null,
            maxSortOrder: { $max: '$sortOrder' }, // Get the maximum value of sortOrder
          },
        },
        {
          $project: {
            _id: 0,
            maxSortOrder: 1, // Only include the maxSortOrder field in the output
          },
        },
      ]);

      const lastTempId = await this.getLastTempId();

      const templateIds = [];
      const imageNames = [];

      const directory = await unzipper.Open.file(zipFilePath);

      let counter = lastTempId + 1;

      await fs.ensureDir(destinationFolder);
      const tempFolder = 'temp_extracted_' + Date.now();
      const extractionPath = path.join(destinationFolder, tempFolder);
      await fs.ensureDir(extractionPath);

      for (const file of directory.files) {
        if (path.extname(file.path).match(/\.(jpg|jpeg|png|gif)$/i)) {
          const outputPath = path.join(extractionPath, file.path);

          await fs.ensureDir(path.dirname(outputPath));
          await file.stream().pipe(fs.createWriteStream(outputPath));
        }
      }

      const files = await fs.readdir(extractionPath);

      const isSingleFolder = files.length === 1 && (await fs.stat(path.join(extractionPath, files[0]))).isDirectory();

      const targetFolder = isSingleFolder ? path.join(extractionPath, files[0]) : extractionPath;

      const imageFiles = await fs.readdir(targetFolder);

      for (const imageFile of imageFiles) {
        const imageFilePath = path.join(targetFolder, imageFile);
        const extension = path.extname(imageFilePath);
        if (extension.match(/\.(jpg|jpeg|png|gif)$/i)) {
          const newFileName = `Image-${counter}.png`;
          const newCoverName = `Cover-${counter}.png`;

          const newFilePath = path.join(destinationFolder, newFileName);
          await fs.move(imageFilePath, newFilePath);

          const newTemplateDoc = await this.templateModel.create({
            thumbnail: newFileName,
            cover: newCoverName,
            tempId: String(counter),
            isEventTemplate: true,
            category,
            sortOrder: maxSortOrder[0].maxSortOrder + 1,
          });

          templateIds.push(newTemplateDoc._id);
          imageNames.push(newFileName);
          counter++;
        }
      }

      await fs.remove(extractionPath);

      await fs.remove(zipFilePath);

      return { templateIds, imageNames };
    } catch (error) {
      Logger.error(error);
      throw new InternalServerErrorException();
    }
  }
  async updateMultiTemplates(conditions, data: Partial<TemplateDocument>): Promise<void> {
    await this.templateModel.updateMany(conditions, data, { new: true });
  }

  async updateMultiTemplatesV2() {
    const data = await this.templateModel.find({ category: Categories.Event });

    for (let doc of data) {
      doc.thumbnail = `Image-${doc.tempId}.png`;
      doc.cover = `Image-${doc.tempId}.png`;
      await doc.save({});
    }

    console.log(data.length);
  }

  async findAllTemplates() {
    return this.templateModel
      .find({
        category: { $eq: null },
      })
      .sort({ cover: -1 });
  }

  async updateTemplates(category: Categories, newName: Categories) {
    // const templates = await this.templateModel.find({ category });
    // return templates;
    return this.templateModel.updateMany({ category }, { category: newName });
  }

  async findAllUserTemplates(user: User) {
    const templates = await this.templateModel.find({});

    templates.forEach((template) => {
      if (user.favorites.includes(template.id)) {
        template.isLiked = true;
      }
    });

    return templates;
  }

  async findTemplateByName(tempId: string) {
    return this.templateModel.find({ tempId });
  }
  async findTemplateById(tempId: string) {
    return this.templateModel.findOne({ tempId });
  }

  async getCategoriesTemplates() {
    const mainCategories = Object.values(Categories).filter((category) => category !== Categories.Event);

    const categories = await this.templateModel.aggregate([
      {
        $match: {
          $and: [{ category: { $ne: null } }, { category: { $in: mainCategories } }],
        },
      },
      {
        $group: {
          _id: '$category',
          categoryTemplates: {
            $push: {
              tempId: '$tempId',
              sortOder: '$sortOrder',
              cover: {
                $concat: [`${this.configService.get<string>('HTTPS_BASE_URL')}/templates/`, '$cover'],
              },
              image: {
                $concat: [`${this.configService.get<string>('HTTPS_BASE_URL')}/templates/`, '$cover'],
              },
            },
          },
          sortOrder: {
            $first: '$sortOrder',
          },
        },
      },
      { $addFields: { category: '$_id' } },

      { $project: { _id: 0, 'categoryTemplates.sortOder': 0 } },
    ]);

    const fixedData = categories.map((el) => {
      return { ...el, category: el.category.replace(/([A-Z])/g, ' $1').trim() };
    });

    const sortedData = fixedData.sort((a, b) => b.sortOrder - a.sortOrder);

    return sortedData;
  }

  async swapsReport(totalImageSwaps, totalVideoSwaps) {
    const totalSuccessfulImageSwaps = totalImageSwaps.filter((el) => el.status === 'success').length;
    const totalSuccessfulVideoSwaps = totalVideoSwaps.filter((el) => el.status === 'success' || el.resultVideo?.length > 0).length;
    const totalFailedVideoSwaps = totalVideoSwaps.filter((el) => el.status === 'failed' || el.resultVideo?.length > 0).length;

    const templateIds = totalImageSwaps.map((el) => el.jobId);

    const templates = await this.templateModel
      .find({
        tempId: { $in: templateIds },
      })
      .exec();
    const eventTempIdsRange = (await this.templateModel.find({ category: 'Event' }).select('tempId')).map((el) => el.tempId).sort();

    const eventSwapsCount = templates.filter((el) => el.category === Categories.Event).length;
    const normalSwapsCount = totalImageSwaps.filter((el) => el.jobId === 'normalFaceSwap').length;

    const templateIdToCategory = templates.reduce((acc, template) => {
      acc[template.tempId] = template.category;
      return acc;
    }, {});

    const categoryCounts = templateIds.reduce((acc, id) => {
      const category = templateIdToCategory[id];
      if (category) {
        acc[category] = (acc[category] || 0) + 1;
      }
      return acc;
    }, {});

    const templateCounts = templateIds.reduce((acc, id) => {
      acc[id] = (acc[id] || 0) + 1;
      return acc;
    }, {});

    delete templateCounts['normalFaceSwap'];
    const topCategories = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => Number(b) - Number(a))
      .slice(0, 3)
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});

    const topTemplates = Object.entries(templateCounts)
      .sort(([, a], [, b]) => Number(b) - Number(a))
      .slice(0, 3)
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});

    const tempImages = await this.templateModel.find({ tempId: { $in: Object.keys(topTemplates) } });

    return {
      categoryCounts,
      eventSwapsCount,
      aiFaceSwapCount: totalImageSwaps.length - normalSwapsCount - eventSwapsCount,
      normalSwapsCount,
      totalImageSwaps: totalImageSwaps.length,
      topTemplates,
      topCategories,
      totalSuccessfulImageSwaps,
      totalFailedImageSwaps: totalImageSwaps.length - totalSuccessfulImageSwaps,
      totalSuccessfulVideoSwaps,
      totalFailedVideoSwaps: totalFailedVideoSwaps.length,
    };
  }

  async updateSortOrder(categoryCounts) {
    for (let category of Object.keys(categoryCounts)) {
      await this.templateModel.updateMany({ category }, { sortOrder: categoryCounts[category] });
    }
  }

  async templateUsages(startDate: Date, endDate: Date) {
    const categoryRanges = await this.templateModel.aggregate([
      {
        $match: { category: { $ne: null } },
      },
      {
        $group: {
          _id: '$category',
          tempIds: {
            $push: '$tempId',
          },
        },
      },
      {
        $project: {
          category: '$_id',

          _id: 0,
          tempIds: 1,
        },
      },
    ]);

    const { sortedInitialCategoryCounts, newData } = await this.userService.getTemplatesUsage(startDate, endDate, categoryRanges);

    return { sortedInitialCategoryCounts, newData };
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
