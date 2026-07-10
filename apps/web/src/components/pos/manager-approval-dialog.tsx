'use client';

import { ShieldCheck } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ManagerApprovalDialog({
  open,
  productName,
  discountLabel,
  onApprove,
  onClose,
}: {
  open: boolean;
  productName: string;
  discountLabel: string;
  /** Returns an error message to display, or null on success (dialog then closes). */
  onApprove: (managerPin: string, note: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [pin, setPin] = React.useState('');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setPin('');
      setNote('');
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      const err = await onApprove(pin, note.trim());
      if (err) setError(err);
    } catch {
      setError('Approval failed. Check the connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Manager approval"
      description={`${productName} · ${discountLabel}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void approve()} disabled={busy || pin.length < 4}>
            <ShieldCheck className="h-4 w-4" />
            {busy ? 'Approving…' : 'Approve'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This discount exceeds the cashier&apos;s limit. A manager must enter their PIN to approve.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="manager-pin">Manager PIN</Label>
          <Input
            id="manager-pin"
            type="password"
            inputMode="numeric"
            autoFocus
            placeholder="••••"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && pin.length >= 4 && void approve()}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="approval-note">Approval note (optional)</Label>
          <Input
            id="approval-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. approved for loyal customer"
          />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
    </Dialog>
  );
}
