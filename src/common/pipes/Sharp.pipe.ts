import { BadRequestException, Injectable, InternalServerErrorException, PipeTransform } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import * as sharp from 'sharp';

@Injectable()
export class SharpPipe implements PipeTransform<Express.Multer.File, Promise<{ image: string; thumbnail: string }>> {
  async transform(image: Express.Multer.File): Promise<any> {
    const size = 720;
    const resizedImagePath = image.path.split('.')[0] + '-resized-' + size + '.jpg';
    await sharp(image.path)
      .resize(size)
      .jpeg({ mozjpeg: true })
      .toBuffer()
      .then((data) => {
        fs.writeFile(resizedImagePath, data, (err) => {
          if (err) {
            console.log('Error saving image:', err);
            throw new InternalServerErrorException('Error saving image ');
          } else {
            return resizedImagePath;
          }
        });
      })
      .catch((err) => {
        throw new InternalServerErrorException('Error saving image ');
      });

    return { image: image.filename, thumbnail: image.filename.split('.')[0] + '-resized-' + size + '.jpg' };
  }
}
