import { join } from 'path';
import * as sharp from 'sharp';
import { InternalServerErrorException } from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';
import { exec } from 'child_process';
import * as fs from 'node:fs';

export async function compressImage(inputPath: string, outputPath: string, fileName: string, resizeDim = 720) {
  try {
    const metadata = await sharp(inputPath).metadata();
    const rawFileName = fileName.split('.')[0];
    if (metadata.width! > resizeDim || metadata.height! > resizeDim) {
      const outputFilePath = join(outputPath, `${rawFileName}-resized-${resizeDim}.jpeg`);

      await sharp(inputPath).rotate().resize(resizeDim).jpeg({ quality: 90 }).toFile(outputFilePath);

      return `${rawFileName}-resized-${resizeDim}.jpeg`;
    }

    return fileName;
  } catch (err) {
    throw new InternalServerErrorException();
  }
}

export async function addTopSpace(inputPath: string, outputPath: string, topColor = { r: 0, g: 0, b: 0, alpha: 0 }) {
  try {
    // Get original image metadata
    const metadata = await sharp(inputPath).metadata();

    // Create new dimensions
    const newHeight = metadata.height + 200;

    // Create a composite image
    await sharp({
      create: {
        width: metadata.width,
        height: newHeight,
        channels: 4,
        background: topColor,
      },
    })
      .composite([
        {
          input: await sharp(inputPath).toBuffer(),
          top: 200,
          left: 0,
        },
      ])
      .toFile(outputPath);

    console.log('Image processed successfully');
  } catch (err) {
    console.error('Error processing image:', err);
  }
}

export function removeTopSection(inputPath: string, outputPath: string) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilter('crop=iw:(ih-100):0:100') // Remove top 100px
      .outputOptions('-c:a copy') // Preserve audio
      .on('end', () => {
        console.log('Top section removed!');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('Error:', err);
        reject(err);
      })
      .save(outputPath);
  });
}

export async function concatenateImagesHorizontally(imagePath1: string, imagePath2: string, outputPath: string) {
  try {
    // Load images.
    const resizedImage1Buffer = await sharp(imagePath1).resize({ width: 720, height: 720, fit: 'inside' }).toBuffer();
    const resizedImage2Buffer = await sharp(imagePath2).resize({ width: 720, height: 720, fit: 'inside' }).toBuffer();

    // Retrieve metadata from the resized images.
    const metadata1 = await sharp(resizedImage1Buffer).metadata();
    const metadata2 = await sharp(resizedImage2Buffer).metadata();

    // Determine final dimensions.
    const finalWidth = (metadata1.width || 0) + (metadata2.width || 0);
    const finalHeight = Math.max(metadata1.height || 0, metadata2.height || 0);

    // Create a new blank canvas.
    const canvas = sharp({
      create: {
        width: finalWidth,
        height: finalHeight,
        channels: 4, // RGBA
        background: { r: 255, g: 255, b: 255, alpha: 1 }, // White background
      },
    });

    // Composite the images onto the canvas.
    await canvas
      .composite([
        { input: resizedImage1Buffer, left: 0, top: 0 },
        { input: resizedImage2Buffer, left: metadata1.width, top: 0 },
      ])

      .jpeg({ quality: 95 })
      .toFile(outputPath);

    console.log(`Concatenated image saved to ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error concatenating images:', error);
  }
}

export function audioExtractor(fileName: string, output: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const command = `ffmpeg -i ${fileName} -q:a 0 -map a ${output}`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(`Error processing video: ${error.message}`);
        return;
      }

      resolve(`${output}`);
    });
  });
}

export function newFpsReducer(inputFile: string, fps: number, output: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const command = `ffmpeg -i ${inputFile} -vf "fps=${fps}" -c:a copy "${output}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(`Error processing video: ${error.message}`);
        return;
      }

      resolve(`${output}`);
    });
  });
}

export function videoAudioMerger(rawFile: string, audioFile: string, output: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const newComm = `ffmpeg -i ${rawFile} -i ${audioFile} -c:v copy -c:a aac -b:a 128k -shortest ${output}`;

    exec(newComm, (error, stdout, stderr) => {
      if (error) {
        reject(`Error processing video: ${error.message}`);
        return;
      }

      resolve(`${output}`);
    });
  });
}

export async function takeFirstFrameScreenshot(videoPath: string, outputPath: string, fileName: string) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: [0],
        filename: fileName,
        folder: outputPath,
      })
      .on('end', () => {
        console.log(`Screenshot saved at ${outputPath}/${fileName}`);
        resolve(fileName);
      })
      .on('error', (err) => {
        console.error(`Error taking first frame screenshot:`, err.message);
        reject(err);
      });
  });
}

export async function createLowResTemplate(inputPath: string, outputPath: string, filename: string) {
  return new Promise((resolve, reject) => {
    const command = `ffmpeg -i ${inputPath} -vf "scale=360:-1" -t 1 -r 10 -vsync cfr -vcodec libwebp -lossless 0 -q:v 75 -preset default -loop 0 -an ${outputPath}/${filename}`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(`Error processing video: ${error.message}`);
        return;
      }

      resolve(`${filename}`);
    });
  });
}

function getImageExtension(imagePath: string): string {
  const ext = imagePath.split('.').pop()?.toLowerCase();
  return ext === 'jpg' ? 'jpeg' : ext || 'png';
}

export function imageToBase64(imagePath: string): string {
  try {
    const fileData = fs.readFileSync(imagePath);
    return `data:image/${getImageExtension(imagePath)};base64,${fileData.toString('base64')}`;
  } catch (error) {
    console.error('Error converting image to Base64:', error);
    throw error;
  }
}
