'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export function ItemNoteDialog({
  open,
  productName,
  initialNote,
  onSave,
  onClose,
}: {
  open: boolean;
  productName: string;
  initialNote?: string;
  onSave: (note: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = React.useState(initialNote ?? '');

  React.useEffect(() => {
    if (open) setNote(initialNote ?? '');
  }, [open, initialNote]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Item note"
      description={productName}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(note.trim())}>Save note</Button>
        </>
      }
    >
      <Textarea
        autoFocus
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. cut to 2m, customer will collect tomorrow…"
      />
    </Dialog>
  );
}
