import { randomUUID } from 'crypto';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BadRequestException } from '@nestjs/common';

import { IMAGE_EXT, ResolvedImage, StorageProvider, UploadedImage } from './storage-provider';
import { IMAGE_KEY_PREFIX, toObjectKey, toStoredPath } from './storage.util';

/**
 * How long a signed object URL stays valid. Only has to outlive the redirect
 * that carries the browser to it, plus REDIRECT_MAX_AGE of reuse from cache.
 */
const SIGNED_URL_TTL_SECONDS = 900;

/**
 * How long the browser may reuse our `/uploads/...` redirect without asking
 * again. Kept well under SIGNED_URL_TTL_SECONDS so a cached redirect can never
 * point at an already-expired signature. Without this the signature would differ
 * on every request, giving each response a fresh cache key and defeating the
 * object's own immutable caching.
 */
const REDIRECT_MAX_AGE_SECONDS = 300;

export interface S3StorageConfig {
  bucket: string;
  region: string;
  /** Custom endpoint (e.g. http://localhost:4566 for LocalStack). Omit for real AWS. */
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

/**
 * S3-compatible object storage (AWS S3, LocalStack, MinIO). Objects are keyed
 * `products/<uuid>.<ext>` and the bucket stays private: reads go out as
 * short-lived presigned URLs minted per request, never as public object URLs.
 */
export class S3StorageProvider implements StorageProvider {
  readonly kind = 's3' as const;
  private readonly client: S3Client;
  private readonly bucket: string;
  /** Object-URL base used only to recognise rows written before keys were stored. */
  private readonly legacyBase: string;

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region,
      // Skip the SDK's default streaming checksums — S3 emulators (LocalStack,
      // MinIO) reset the connection on the aws-chunked trailer encoding.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      ...(config.endpoint
        ? {
            endpoint: config.endpoint,
            // Custom endpoints (LocalStack/MinIO) don't resolve bucket subdomains.
            forcePathStyle: true,
          }
        : {}),
      ...(config.accessKeyId && config.secretAccessKey
        ? {
            credentials: {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            },
          }
        : {}),
    });
    this.legacyBase = config.endpoint
      ? `${config.endpoint.replace(/\/$/, '')}/${config.bucket}`
      : `https://${config.bucket}.s3.${config.region}.amazonaws.com`;
  }

  async saveImage(file: UploadedImage): Promise<string> {
    const ext = IMAGE_EXT[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Unsupported image type (use PNG, JPEG, WebP, or GIF)');
    }
    const key = `${IMAGE_KEY_PREFIX}/${randomUUID()}${ext}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        // Cache aggressively — keys are content-unique (UUID per upload).
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return toStoredPath(key);
  }

  async remove(storedPath: string | null | undefined): Promise<void> {
    const key = toObjectKey(storedPath) ?? this.legacyKey(storedPath);
    if (!key) return;
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch {
      /* already gone — ignore */
    }
  }

  async resolve(key: string): Promise<ResolvedImage> {
    // Signing is a local HMAC over the request description — no call to AWS.
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: SIGNED_URL_TTL_SECONDS },
    );
    return { kind: 'redirect', url, maxAgeSeconds: REDIRECT_MAX_AGE_SECONDS };
  }

  /** Key behind an absolute object URL stored before this provider kept keys. */
  private legacyKey(storedPath: string | null | undefined): string | null {
    if (!storedPath || !storedPath.startsWith(`${this.legacyBase}/`)) return null;
    return storedPath.slice(this.legacyBase.length + 1);
  }
}
