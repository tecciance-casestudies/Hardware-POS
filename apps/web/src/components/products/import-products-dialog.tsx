'use client';

import { Download, FileUp, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import * as React from 'react';

import { ProductImage } from '@/components/product-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import type { Session } from '@/lib/auth';
import {
  commitProductImport,
  downloadProductTemplate,
  previewProductImport,
  uploadProductImage,
  type ImportCommitSummary,
  type ParsedProductRow,
} from '@/lib/products-api';
import { formatMoney } from '@/lib/utils';

type Phase = 'select' | 'review' | 'done';

interface AttachedImage {
  file: File;
  url: string;
}

const TYPE_LABEL: Record<ParsedProductRow['type'], string> = {
  Inventory: 'Inventory',
  NonInventory: 'Non-Inventory',
  Service: 'Service',
};

/**
 * Bulk product import from the QuickBooks Products & Services template. Two
 * phases with a review step in between: upload → review every parsed row (and
 * optionally attach a photo per product, since images aren't in the sheet) →
 * commit. Nothing is created until "Create products" is pressed.
 */
export function ImportProductsDialog({
  session,
  open,
  onClose,
  onImported,
}: {
  session: Session;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [phase, setPhase] = React.useState<Phase>('select');
  const [file, setFile] = React.useState<File | null>(null);
  const [rows, setRows] = React.useState<ParsedProductRow[]>([]);
  const [images, setImages] = React.useState<Map<number, AttachedImage>>(new Map());
  const [summary, setSummary] = React.useState<ImportCommitSummary | null>(null);
  const [imageStats, setImageStats] = React.useState<{ uploaded: number; failed: number }>({
    uploaded: 0,
    failed: 0,
  });
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const fileInput = React.useRef<HTMLInputElement>(null);
  const imageInput = React.useRef<HTMLInputElement>(null);
  const pendingImageRow = React.useRef<number | null>(null);

  const revokeAll = React.useCallback((map: Map<number, AttachedImage>) => {
    map.forEach((img) => URL.revokeObjectURL(img.url));
  }, []);

  const reset = React.useCallback(() => {
    setImages((prev) => {
      revokeAll(prev);
      return new Map();
    });
    setPhase('select');
    setFile(null);
    setRows([]);
    setSummary(null);
    setImageStats({ uploaded: 0, failed: 0 });
    setBusy(false);
    setProgress(null);
    setError(null);
  }, [revokeAll]);

  React.useEffect(() => () => revokeAll(images), [images, revokeAll]);

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const committable = rows.filter((r) => r.errors.length === 0);
  const creates = committable.filter((r) => r.matchStatus === 'create').length;
  const updates = committable.filter((r) => r.matchStatus === 'update').length;
  const errored = rows.length - committable.length;

  // ── template ──
  const handleDownloadTemplate = async () => {
    setError(null);
    try {
      await downloadProductTemplate(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download the template');
    }
  };

  // ── preview ──
  const handlePreview = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const parsed = await previewProductImport(session, file);
      setRows(parsed);
      setPhase('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the file');
    } finally {
      setBusy(false);
    }
  };

  // ── per-row image ──
  const openImagePicker = (rowNumber: number) => {
    pendingImageRow.current = rowNumber;
    imageInput.current?.click();
  };

  const onImageChosen = (fileList: FileList | null) => {
    const picked = fileList?.[0];
    const rowNumber = pendingImageRow.current;
    if (!picked || rowNumber == null) return;
    setImages((prev) => {
      const next = new Map(prev);
      const existing = next.get(rowNumber);
      if (existing) URL.revokeObjectURL(existing.url);
      next.set(rowNumber, { file: picked, url: URL.createObjectURL(picked) });
      return next;
    });
    if (imageInput.current) imageInput.current.value = '';
  };

  const removeImage = (rowNumber: number) => {
    setImages((prev) => {
      const next = new Map(prev);
      const existing = next.get(rowNumber);
      if (existing) URL.revokeObjectURL(existing.url);
      next.delete(rowNumber);
      return next;
    });
  };

  // ── commit ──
  const handleCommit = async () => {
    if (committable.length === 0) return;
    setBusy(true);
    setError(null);
    setProgress('Creating products…');
    try {
      const result = await commitProductImport(session, committable);
      setSummary(result);

      // Attach the images the user assigned to the products just created.
      const withImages = result.results.filter(
        (r) => r.productId && images.has(r.rowNumber),
      );
      let uploaded = 0;
      let failed = 0;
      for (const [i, r] of withImages.entries()) {
        setProgress(`Uploading images… (${i + 1}/${withImages.length})`);
        const img = images.get(r.rowNumber);
        if (!img || !r.productId) continue;
        try {
          await uploadProductImage(session, r.productId, img.file);
          uploaded++;
        } catch {
          failed++;
        }
      }
      setImageStats({ uploaded, failed });
      setPhase('done');
      if (result.created > 0 || result.updated > 0) onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  // ── render ──
  const footer =
    phase === 'select' ? (
      <>
        <Button variant="outline" onClick={handleClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={handlePreview} disabled={!file || busy} isLoading={busy}>
          Upload &amp; review
        </Button>
      </>
    ) : phase === 'review' ? (
      <>
        <Button variant="outline" onClick={reset} disabled={busy}>
          Back
        </Button>
        <Button onClick={handleCommit} disabled={committable.length === 0 || busy} isLoading={busy}>
          Create {committable.length} product{committable.length === 1 ? '' : 's'}
        </Button>
      </>
    ) : (
      <Button onClick={handleClose}>Done</Button>
    );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      className={phase === 'review' ? 'sm:max-w-5xl' : 'sm:max-w-lg'}
      title="Import products"
      description={
        phase === 'select'
          ? 'Upload a QuickBooks Products & Services spreadsheet (.xlsx or .csv).'
          : phase === 'review'
            ? 'Review the products before creating them. Attach a photo to any row.'
            : 'Import complete.'
      }
      footer={footer}
    >
      {/* shared hidden inputs */}
      <input
        ref={fileInput}
        type="file"
        accept=".xlsx,.csv"
        className="hidden"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <input
        ref={imageInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => onImageChosen(e.target.files)}
      />

      {phase === 'select' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-3">
            <div className="text-sm">
              <div className="font-medium">Need the template?</div>
              <div className="text-xs text-muted-foreground">
                Download it, fill in your products, then upload it here.
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4" />
              Template
            </Button>
          </div>

          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 text-center transition-colors hover:bg-muted"
          >
            <FileUp className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">{file ? file.name : 'Choose a spreadsheet'}</span>
            <span className="text-xs text-muted-foreground">.xlsx or .csv · max 10 MB</span>
          </button>

          <p className="text-xs text-muted-foreground">
            Existing products are matched by SKU (or name) and updated. Images aren&apos;t part of
            the sheet — you can attach them in the next step.
          </p>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>
      ) : null}

      {phase === 'review' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="success">{creates} to create</Badge>
            <Badge variant="primary">{updates} to update</Badge>
            {errored > 0 ? <Badge variant="danger">{errored} with errors (excluded)</Badge> : null}
          </div>

          <div className="max-h-[52vh] overflow-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr className="text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Image</th>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 text-right font-medium">Price</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const img = images.get(r.rowNumber);
                  const hasError = r.errors.length > 0;
                  return (
                    <tr
                      key={r.rowNumber}
                      className={`border-t border-border ${hasError ? 'bg-danger-soft/30' : ''}`}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <ProductImage
                            src={img?.url ?? null}
                            alt={r.name}
                            className="h-9 w-9 shrink-0"
                          />
                          {img ? (
                            <button
                              type="button"
                              onClick={() => removeImage(r.rowNumber)}
                              aria-label="Remove image"
                              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-danger"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openImagePicker(r.rowNumber)}
                              aria-label={`Add image for ${r.name}`}
                              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-primary"
                            >
                              <ImagePlus className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.sku ?? 'No SKU'}</div>
                        {hasError ? (
                          <div className="mt-0.5 text-xs text-danger">{r.errors.join('; ')}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{TYPE_LABEL[r.type]}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.categoryPath ?? '—'}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(r.unitPrice)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {r.type === 'Inventory' ? r.quantityOnHand : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {hasError ? (
                          <Badge variant="danger">Error</Badge>
                        ) : r.matchStatus === 'update' ? (
                          <Badge variant="primary">Update</Badge>
                        ) : (
                          <Badge variant="success">Create</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {progress ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {progress}
            </p>
          ) : null}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>
      ) : null}

      {phase === 'done' && summary ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <ResultTile label="Created" value={summary.created} tone="success" />
            <ResultTile label="Updated" value={summary.updated} tone="primary" />
            <ResultTile
              label="Failed"
              value={summary.failed}
              tone={summary.failed > 0 ? 'danger' : 'neutral'}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {imageStats.uploaded} image{imageStats.uploaded === 1 ? '' : 's'} uploaded
            {imageStats.failed > 0 ? `, ${imageStats.failed} failed` : ''}.
          </p>
          {summary.results.some((r) => r.outcome === 'failed') ? (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-danger/30 bg-danger-soft/40 p-3 text-xs text-danger">
              {summary.results
                .filter((r) => r.outcome === 'failed')
                .map((r) => (
                  <div key={r.rowNumber}>
                    Row {r.rowNumber}: {r.error}
                  </div>
                ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </Dialog>
  );
}

function ResultTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'success' | 'primary' | 'neutral' | 'danger';
}) {
  const toneClass = {
    success: 'text-success',
    primary: 'text-primary',
    neutral: 'text-foreground',
    danger: 'text-danger',
  }[tone];
  return (
    <div className="rounded-xl border border-border p-3 text-center">
      <div className={`text-2xl font-semibold ${toneClass}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
