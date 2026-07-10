'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/auth';
import { Permission } from '@/lib/permissions';
import { useQuickBooks } from '@/lib/quickbooks';

export default function QuickBooksSettingsPage() {
  const { state } = useQuickBooks();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(Permission.QUICKBOOKS_MANAGE);

  const [autoSyncProducts, setAutoSyncProducts] = React.useState(true);
  const [pushSales, setPushSales] = React.useState(true);
  const [syncInterval, setSyncInterval] = React.useState('15');

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Sync settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <ToggleRow
          label="Auto-sync products"
          hint="Pull products, prices, and stock from QuickBooks on a schedule."
          checked={autoSyncProducts}
          onChange={setAutoSyncProducts}
          disabled={!canManage}
        />
        <ToggleRow
          label="Push sales automatically"
          hint="Send completed sales to QuickBooks as they are finalized."
          checked={pushSales}
          onChange={setPushSales}
          disabled={!canManage}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="interval">Sync interval</Label>
            <Select
              id="interval"
              value={syncInterval}
              onChange={(e) => setSyncInterval(e.target.value)}
              disabled={!canManage}
            >
              <option value="5">Every 5 minutes</option>
              <option value="15">Every 15 minutes</option>
              <option value="30">Every 30 minutes</option>
              <option value="60">Every hour</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="env">Environment</Label>
            <Select id="env" value={state.company?.environment ?? 'Sandbox'} disabled>
              <option>Sandbox</option>
              <option>Production</option>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button disabled={!canManage}>Save settings</Button>
          <span className="text-xs text-muted-foreground">Settings are simulated for now.</span>
        </div>
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
