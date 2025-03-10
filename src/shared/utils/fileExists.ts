import { access } from 'fs/promises';

export async function checkFileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch (err) {
    return false;
  }
}
