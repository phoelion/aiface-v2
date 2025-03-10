import { BadRequestException } from '@nestjs/common';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { v4 as uuid } from 'uuid';

export const multerConfig = {
  dest: join(__dirname, '..', '..', 'fancy', 'aiface'),
};

export const multerOptions = {
  limits: {
    fileSize: 10000000,
  },
  fileFilter: (req: any, file: any, cb: any) => {
    const arr = file.originalname.split('.');

    if (['jpg', 'jpeg', 'png'].includes(arr[arr.length - 1])) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          `Unsupported file type ${extname(file.originalname)}`,
        ),
        false,
      );
    }
  },
  storage: diskStorage({
    destination: (req: any, file: any, cb: any) => {
      const uploadPath = multerConfig.dest;

      if (!existsSync(uploadPath)) {
        mkdirSync(uploadPath);
      }
      cb(null, uploadPath);
    },

    filename: (req: any, file: any, cb: any) => {
      cb(null, `${uuid()}${extname(file.originalname)}`);
    },
  }),
};
