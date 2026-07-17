'use client';

import { FileUp, Loader2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import type { Session } from '@/lib/auth';
import { importProducts, type ImportSummary } from '@/lib/products-api';

/**
 * Bulk product upload from the QuickBooks Products & Services template
 * (.xlsx or .csv). Shows the per-row outcome after the import runs.
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
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<ImportSummary | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setError(null);
    setSummary(null);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const handleImport = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const result = await importProducts(session, file);
      setSummary(result);
      if (result.created > 0 || result.updated > 0) onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      className="sm:max-w-lg"
      title="Import products"
      description="Upload a QuickBooks Products & Services spreadsheet (.xlsx or .csv)."
      footer={
        summary ? (
          <Button onClick={handleClose}>Done</Button>
        ) : (
          <>
            <Button variant="outline" onClick={handleClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!file || busy} isLoading={busy}>
              Import
            </Button>
          </>
        )
      }
    >
      {summary ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ResultTile label="Created" value={summary.created} tone="success" />
            <ResultTile label="Updated" value={summary.updated} tone="primary" />
            <ResultTile label="Skipped" value={summary.skipped} tone="neutral" />
            <ResultTile
              label="Failed"
              value={summary.failed}
              tone={summary.failed > 0 ? 'danger' : 'neutral'}
            />
          </div>
          {summary.errors.length > 0 ? (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-danger/30 bg-danger-soft/40 p-3 text-xs text-danger">
              {summary.errors.map((e, i) => (
                <div key={i}>
                  Row {e.row}: {e.message}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 text-center transition-colors hover:bg-muted"
          >
            {busy ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <FileUp className="h-8 w-8 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">
              {file ? file.name : 'Choose a spreadsheet'}
            </span>
            <span className="text-xs text-muted-foreground">.xlsx or .csv · max 10 MB</span>
          </button>
          <p className="text-xs text-muted-foreground">
            Columns: Product/service name, Category (use Parent:Sub for subcategories), Item type
            (Inventory, Non-Inventory, Service), SKU, Sales description, Sales price/rate, Purchase
            description, Purchase cost, Quantity on hand, Quantity as of date, Reorder point.
            Existing products are matched by SKU (or name) and updated.
          </p>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>
      )}
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
