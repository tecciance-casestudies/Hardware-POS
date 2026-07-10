'use client';

import { Cloud, CloudOff, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

type SyncState = 'synced' | 'pending' | 'offline';

const CONFIG: Record<SyncState, { label: string; variant: 'success' | 'warning' | 'danger'; Icon: typeof Cloud }> = {
  synced: { label: 'Synced', variant: 'success', Icon: Cloud },
  pending: { label: 'Sync pending', variant: 'warning', Icon: RefreshCw },
  offline: { label: 'Offline', variant: 'danger', Icon: CloudOff },
};

/** QuickBooks sync status pill for the header. Mocked to "synced" for now. */
export function SyncStatus({ state = 'synced' }: { state?: SyncState }) {
  const { label, variant, Icon } = CONFIG[state];
  return (
    <Badge variant={variant}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  );
}
