import { LocalDiskStorageProvider } from './local-disk-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';
import {
  STORAGE_PROVIDER_KINDS,
  type StorageProvider,
  type StorageProviderKind,
} from './storage-provider';
import {
  IMAGE_CACHE_MAX_AGE_DEFAULT_SECONDS,
  readIntEnv,
  SIGNED_URL_TTL_DEFAULT_SECONDS,
} from './storage.util';

export interface StorageEnv {
  STORAGE_PROVIDER?: string;
  S3_BUCKET?: string;
  S3_REGION?: string;
  S3_ENDPOINT?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_SIGNED_URL_TTL_SECONDS?: string;
  IMAGE_CACHE_MAX_AGE_SECONDS?: string;
}

function isKind(value: string): value is StorageProviderKind {
  return (STORAGE_PROVIDER_KINDS as readonly string[]).includes(value);
}

/**
 * Resolve the upload-storage provider from the environment: 'local' (default;
 * files on the API server's disk) or 's3' (AWS S3 / LocalStack / MinIO).
 * Swapping backends is an env change, not a code change.
 */
export function createStorageProvider(env: StorageEnv = process.env): StorageProvider {
  const kind = env.STORAGE_PROVIDER ?? 'local';
  if (!isKind(kind)) {
    throw new Error(
      `Unknown STORAGE_PROVIDER "${kind}" — expected one of: ${STORAGE_PROVIDER_KINDS.join(', ')}`,
    );
  }

  if (kind === 's3') {
    if (!env.S3_BUCKET) {
      throw new Error('STORAGE_PROVIDER=s3 requires S3_BUCKET to be set');
    }
    return new S3StorageProvider({
      bucket: env.S3_BUCKET,
      region: env.S3_REGION ?? 'us-east-1',
      endpoint: env.S3_ENDPOINT || undefined,
      accessKeyId: env.S3_ACCESS_KEY_ID || undefined,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY || undefined,
      signedUrlTtlSeconds: readIntEnv(env.S3_SIGNED_URL_TTL_SECONDS, SIGNED_URL_TTL_DEFAULT_SECONDS),
      cacheMaxAgeSeconds: readIntEnv(
        env.IMAGE_CACHE_MAX_AGE_SECONDS,
        IMAGE_CACHE_MAX_AGE_DEFAULT_SECONDS,
      ),
    });
  }

  return new LocalDiskStorageProvider();
}
