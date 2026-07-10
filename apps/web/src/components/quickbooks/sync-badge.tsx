import { AlertTriangle, Check, Clock, Loader2, Minus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { SyncState } from '@/lib/quickbooks';

const CONFIG: Record<
  SyncState,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral'; Icon: typeof Check; spin?: boolean }
> = {
  SYNCED: { label: 'Synced', variant: 'success', Icon: Check },
  SYNCING: { label: 'Syncing', variant: 'warning', Icon: Loader2, spin: true },
  PENDING: { label: 'Pending', variant: 'warning', Icon: Clock },
  FAILED: { label: 'Failed', variant: 'danger', Icon: AlertTriangle },
  NOT_SYNCED: { label: 'Not synced', variant: 'neutral', Icon: Minus },
};

export function SyncBadge({ status }: { status: SyncState }) {
  const { label, variant, Icon, spin } = CONFIG[status];
  return (
    <Badge variant={variant}>
      <Icon className={`h-3.5 w-3.5${spin ? ' animate-spin' : ''}`} />
      {label}
    </Badge>
  );
}
