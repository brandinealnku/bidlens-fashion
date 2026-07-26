import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { validateUpload } from '@/lib/security';

export type SaveImageInput = {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
  userId: string;
};
export type SavedImage = {
  storagePath: string;
  mimeType: string;
  size: number;
};
export interface ImageStorageProvider {
  save(input: SaveImageInput): Promise<SavedImage>;
  delete(storagePath: string): Promise<void>;
  getDisplayUrl(storagePath: string): Promise<string>;
}
const root = path.join(process.cwd(), '.data', 'uploads');
function absolute(storagePath: string) {
  const clean = path.normalize(storagePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const result = path.join(root, clean);
  if (!result.startsWith(root)) throw new Error('Invalid storage path');
  return result;
}
export class LocalImageStorageProvider implements ImageStorageProvider {
  async save(input: SaveImageInput) {
    validateUpload(input.fileName, input.mimeType, input.bytes.byteLength);
    const bytes = input.bytes;
    const validSignature =
      (input.mimeType === 'image/jpeg' &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff) ||
      (input.mimeType === 'image/png' &&
        bytes
          .slice(0, 8)
          .every(
            (value, index) =>
              value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index],
          )) ||
      (input.mimeType === 'image/webp' &&
        new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
        new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP');
    if (!validSignature)
      throw new Error('Image content does not match its MIME type');
    const extension =
      input.mimeType === 'image/png'
        ? '.png'
        : input.mimeType === 'image/webp'
          ? '.webp'
          : '.jpg';
    const storagePath = `${input.userId}/${crypto.randomUUID()}${extension}`;
    const target = absolute(storagePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, input.bytes, { flag: 'wx' });
    return {
      storagePath,
      mimeType: input.mimeType,
      size: input.bytes.byteLength,
    };
  }
  async delete(storagePath: string) {
    await unlink(absolute(storagePath)).catch((error: unknown) => {
      if (
        !(error instanceof Error && 'code' in error && error.code === 'ENOENT')
      )
        throw error;
    });
  }
  async getDisplayUrl(storagePath: string) {
    return `/api/uploads/${encodeURIComponent(storagePath)}`;
  }
  async read(storagePath: string) {
    return readFile(absolute(storagePath));
  }
}
