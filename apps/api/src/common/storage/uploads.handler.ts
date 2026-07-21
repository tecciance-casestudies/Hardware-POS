import type { Request, RequestHandler, Response } from 'express';

import { StorageService } from './storage.service';
import { UPLOAD_URL_PREFIX } from './storage.util';

/**
 * Serves stored images at `/uploads/<key>` — the same stable path recorded on
 * every product, category, and branding record, so nothing upstream has to
 * change when the storage backend does.
 *
 * Local disk streams the file. S3 mints a presigned URL here, per request, and
 * redirects to it; the bucket itself stays private. The redirect is cacheable
 * for a window shorter than the signature's lifetime, so repeat views reuse one
 * signed URL and still hit the browser cache.
 */
export function uploadsHandler(storage: StorageService): RequestHandler {
  // Local files are served directly with this header (S3 objects carry their own,
  // set at upload). Keys are UUID-unique and never overwritten, so `immutable` lets
  // the browser trust its cache for the full max-age.
  const fileCacheControl = `public, max-age=${storage.imageCacheMaxAgeSeconds}, immutable`;
  return (req: Request, res: Response): void => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.status(405).end();
      return;
    }

    let requestedPath: string;
    try {
      requestedPath = `${UPLOAD_URL_PREFIX}${decodeURIComponent(req.path)}`;
    } catch {
      // Malformed percent-encoding — decodeURIComponent throws on e.g. "%zz".
      res.status(400).end();
      return;
    }

    void storage
      .resolve(requestedPath)
      .then((resolved) => {
        if (!resolved) {
          res.status(404).end();
          return;
        }
        if (resolved.kind === 'redirect') {
          res.setHeader('Cache-Control', `private, max-age=${resolved.maxAgeSeconds}`);
          res.redirect(302, resolved.url);
          return;
        }
        res.setHeader('Cache-Control', fileCacheControl);
        res.sendFile(resolved.path, (err) => {
          if (err && !res.headersSent) res.status(404).end();
        });
      })
      .catch(() => {
        if (!res.headersSent) res.status(404).end();
      });
  };
}
