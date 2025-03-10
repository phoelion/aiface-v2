import { createWriteStream } from 'fs';
import axios, { AxiosError } from 'axios';

export async function downloadFile(fileUrl: string, outputLocationPath: string): Promise<any> {
  try {
    const response = await axios({
      url: fileUrl,
      method: 'GET',
      responseType: 'stream',
    });

    if (!response || !response.data) {
      throw new Error('Invalid response from server');
    }

    const writer = createWriteStream(outputLocationPath);

    response.data.pipe(writer);

    return new Promise((resolve: any, reject) => {
      writer.on('finish', resolve);
      writer.on('error', (error) => {
        console.error('File writing error:', error);
        reject(error);
      });
    });
  } catch (error) {
    console.error('Download failed');
    return false;
  }
}
