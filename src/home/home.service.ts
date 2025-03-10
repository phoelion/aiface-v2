import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Home } from './schema/home.schema';
import { Model } from 'mongoose';

@Injectable()
export class HomeService {
  constructor(@InjectModel(Home.name) private homeModel: Model<Home>) {}

  async setHomeConfigs(data: Partial<Home>) {
    const { icons } = data;
    let config = await this.getHomeConfigs();
    console.log(config);
    if (!config) {
      return this.homeModel.create({ icons });
    } else {
      const newIcons = { ...config.icons, ...icons };
      return this.homeModel.findByIdAndUpdate(config._id, { icons: newIcons }, { new: true });
    }
  }

  async setFeature({ featureName, featureValue }) {
    let config = await this.getHomeConfigs();
    return this.homeModel.findByIdAndUpdate(
      config._id,
      {
        features: {
          ...config.features,
          ...{
            [featureName]: featureValue,
          },
        },
      },
      { new: true }
    );
  }
  async setAppConstants(setAppConstantsDto) {
    const { appConstantName, appConstantValue } = setAppConstantsDto;
    let config = await this.getHomeConfigs();
    return this.homeModel.findByIdAndUpdate(
      config._id,
      {
        appConstants: {
          ...config.appConstants,
          ...{
            [appConstantName]: appConstantValue,
          },
        },
      },
      { new: true }
    );
  }

  async getHomeConfigs(): Promise<Home | null> {
    return this.homeModel.findOne();
  }
}
