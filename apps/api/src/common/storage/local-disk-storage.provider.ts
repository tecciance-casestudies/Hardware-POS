import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { dirname, join } from 'path';

import { BadRequestException } from '@nestjs/common';

import { IMAGE_EXT, ResolvedImage, StorageProvider, UploadedImage } from './storage-provider';
import { getUploadDir, IMAGE_KEY_PREFIX, toObjectKey, toStoredPath } from './storage.util';

/** Local filesystem storage: files under `<UPLOAD_DIR>/<key>`, served at `/uploads/<key>`. */
export class LocalDiskStorageProvider implements StorageProvider {
  readonly kind = 'local' as const;
  private readonly dir = getUploadDir();

  async saveImage(file: UploadedImage): Promise<string> {
    const ext = IMAGE_EXT[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Unsupported image type (use PNG, JPEG, WebP, or GIF)');
    }
    const key = `${IMAGE_KEY_PREFIX}/${randomUUID()}${ext}`;
    const dest = join(this.dir, key);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, file.buffer);
    return toStoredPath(key);
  }

  async remove(storedPath: string | null | undefined): Promise<void> {
    const key = toObjectKey(storedPath);
    if (!key) return;
    try {
      await unlink(join(this.dir, key));
    } catch {
      /* already gone — ignore */
    }
  }

  // Keys written before uploads were namespaced are flat (`<uuid>.png`) and
  // still resolve here, so rows predating the key prefix keep working.
  resolve(key: string): Promise<ResolvedImage> {
    return Promise.resolve({ kind: 'file', path: join(this.dir, key) });
  }
}
