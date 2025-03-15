import { BadRequestException } from '@nestjs/common';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuid } from 'uuid';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(__dirname, '..', '..', '.env') });

export const multerConfig = {
  dest: join(__dirname, '..', '..', 'public'),
  home: join(__dirname, '..', '..', 'public', 'home'),
  imageTemplates: join(__dirname, '..', '..', 'public', 'templates', 'photo'),
  videoTemplates: join(__dirname, '..', '..', 'public', 'templates', 'video'),
};
export const MULTER_OPTIONS_PUBLIC = {
  limits: {
    fileSize: 100_000_000,
  },
  fileFilter: (req: any, file: any, cb: any) => {
    const arr = file.originalname.split('.');

    if (['jpg', 'jpeg', 'png'].includes(arr[arr.length - 1])) {
      cb(null, true);
    } else {
      cb(new BadRequestException(`Unsupported file type ${extname(file.originalname)}`), false);
    }
  },
  storage: diskStorage({
    destination: (req: any, file: any, cb: any) => {
      const uploadPath = join(multerConfig.dest);

      if (!existsSync(uploadPath)) {
        mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },

    filename: (req: any, file: any, cb: any) => {
      cb(null, `${uuid()}${extname(file.originalname)}`);
    },
  }),
};

export const MULTER_OPTIONS_HOME = {
  limits: {
    fileSize: 10000000,
  },
  fileFilter: (req: any, file: any, cb: any) => {
    const arr = file.originalname.split('.');

    if (['jpg', 'jpeg', 'png'].includes(arr[arr.length - 1])) {
      cb(null, true);
    } else {
      cb(new BadRequestException(`Unsupported file type ${extname(file.originalname)}`), false);
    }
  },
  storage: diskStorage({
    destination: (req: any, file: any, cb: any) => {
      const uploadPath = join(multerConfig.home);

      if (!existsSync(uploadPath)) {
        mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },

    filename: (req: any, file: any, cb: any) => {
      cb(null, `${uuid()}${extname(file.originalname)}`);
    },
  }),
};

export const MULTER_OPTIONS_IMAGE_TEMPLATE = {
  limits: {
    fileSize: 10_000_000,
  },
  fileFilter: (req: any, file: any, cb: any) => {
    const arr = file.originalname.split('.');

    if (['jpg', 'jpeg', 'png'].includes(arr[arr.length - 1])) {
      cb(null, true);
    } else {
      cb(new BadRequestException(`Unsupported file type ${extname(file.originalname)}`), false);
    }
  },
  storage: diskStorage({
    destination: (req: any, file: any, cb: any) => {
      const uploadPath = join(multerConfig.imageTemplates);

      if (!existsSync(uploadPath)) {
        mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },

    filename: (req: any, file: any, cb: any) => {
      cb(null, `${uuid()}${extname(file.originalname)}`);
    },
  }),
};
export const MULTER_OPTIONS_VIDEO_TEMPLATE = {
  limits: {
    fileSize: 10_000_000,
  },

  storage: diskStorage({
    destination: (req: any, file: any, cb: any) => {
      const uploadPath = join(multerConfig.videoTemplates);

      if (!existsSync(uploadPath)) {
        mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },

    filename: (req: any, file: any, cb: any) => {
      cb(null, `${uuid()}${extname(file.originalname)}`);
    },
  }),
};

export const GLOBAL_PREFIX = '/api';
export const SERVE_ROOT_URL = '/public/';
export const FPS = 20;

export const PHOTO_TEMPLATES_BASE_URL = process.env[`BASE_URL_${process.env.NODE_ENV}`] + '/public' + '/templates' + '/photo' + '/';
export const VIDEO_TEMPLATES_BASE_URL = process.env[`BASE_URL_${process.env.NODE_ENV}`] + '/public' + '/templates' + '/video' + '/';

export const VIDEO_TEMPLATES_POSTFIX = '-low-res-webp.webp';
