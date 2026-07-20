import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

import { createStorageProvider } from './create-storage-provider';
import {
  IMAGE_EXT,
  type ResolvedImage,
  type StorageProvider,
  type UploadedImage,
} from './storage-provider';
import { toObjectKey } from './storage.util';

/** Longest-edge cap applied to every stored image, in pixels. */
const MAX_IMAGE_EDGE = 780;
/** WebP encoder quality (0-100). 80 keeps product photos crisp at well under 300 KB. */
const WEBP_QUALITY = 80;

/**
 * Facade the rest of the app injects for file storage. WHERE files live is
 * decided by the provider resolved from `STORAGE_PROVIDER` (local disk by
 * default, S3/LocalStack with 's3') — see create-storage-provider.ts.
 */
@Injectable()
export class StorageService {
  private static readonly logger = new Logger(StorageService.name);
  private readonly provider: StorageProvider;

  constructor() {
    this.provider = createStorageProvider(process.env);
    StorageService.logger.log(`Upload storage provider: ${this.provider.kind}`);
  }

  /**
   * Downscale to at most MAX_IMAGE_EDGE on the longest side, re-encode to WebP,
   * and persist; returns the stored image's public URL. Both callers (product
   * photos and document branding assets) go through here, so the size cap holds
   * for every stored image whichever provider is configured.
   */
  async saveImage(file: UploadedImage): Promise<string> {
    // Guard here rather than in the providers: they only ever see the WebP we
    // produce below, so an unsupported upload has to be rejected up front.
    if (!IMAGE_EXT[file.mimetype]) {
      throw new BadRequestException('Unsupported image type (use PNG, JPEG, WebP, or GIF)');
    }
    const buffer = await compressImage(file.buffer);
    return this.provider.saveImage({ buffer, mimetype: 'image/webp' });
  }

  /** Remove a previously stored file by its stored path (no-op if external/missing). */
  remove(storedPath: string | null | undefined): Promise<void> {
    return this.provider.remove(storedPath);
  }

  /**
   * Resolve a stored path into something the browser can load. Called once per
   * image request rather than once per API response, so an S3 signature only
   * has to outlive the redirect — not the cashier's whole POS session.
   * Returns null for paths that aren't ours (never trust the request URL).
   */
  async resolve(storedPath: string): Promise<ResolvedImage | null> {
    const key = toObjectKey(storedPath);
    return key ? this.provider.resolve(key) : null;
  }
}

/**
 * Resize and re-encode an uploaded image. WebP rather than JPEG because the
 * logo, signature, and stamp assets are drawn onto documents and rely on
 * transparency, which JPEG would flatten. Animated GIFs keep their first frame.
 */
async function compressImage(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer)
      // Phone photos carry their orientation in EXIF; apply it before re-encoding
      // drops the metadata, or portrait shots come out sideways.
      .rotate()
      .resize(MAX_IMAGE_EDGE, MAX_IMAGE_EDGE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  } catch {
    // sharp throws on truncated/corrupt input or a mislabelled mimetype.
    throw new BadRequestException('Could not read that image file');
  }
}
