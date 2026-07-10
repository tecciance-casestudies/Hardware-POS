'use client';

import { useRouter } from 'next/navigation';
import { CheckCircle2, Link2, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { Permission } from '@/lib/permissions';
import { formatQbTime, useQuickBooks } from '@/lib/quickbooks';

export default function QuickBooksConnectPage() {
  const { state, connect, disconnect } = useQuickBooks();
  const { hasPermission } = useAuth();
  const router = useRouter();
  const canManage = hasPermission(Permission.QUICKBOOKS_MANAGE);

  if (state.connected && state.company) {
    return (
      <Card className="max-w-xl">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success-soft text-success">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <div>
              <div className="font-semibold">Connected</div>
              <div className="text-sm text-muted-foreground">
                {state.company.name} · connected {formatQbTime(state.connectedAtISO)}
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={disconnect} disabled={!canManage}>
            Disconnect
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Link2 className="h-5 w-5" />
          </span>
          <CardTitle>Connect to QuickBooks Online</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          You will be redirected to QuickBooks to authorize access. The POS reads products, prices,
          and stock, and writes sales receipts, invoices, and payments back to QuickBooks.
        </p>

        <ul className="space-y-2 text-sm">
          {['Read products, prices, and quantity on hand', 'Create sales receipts, invoices, and payments', 'Read customers'].map(
            (line) => (
              <li key={line} className="flex items-center gap-2 text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-success" />
                {line}
              </li>
            ),
          )}
        </ul>

        <div className="flex items-center gap-2">
          <Badge variant="warning">Sandbox</Badge>
          <span className="text-xs text-muted-foreground">
            Simulated connection — real OAuth is not implemented yet.
          </span>
        </div>

        <Button
          size="lg"
          disabled={!canManage}
          onClick={() => {
            connect();
            router.push('/quickbooks');
          }}
        >
          <Link2 className="h-4 w-4" />
          Connect QuickBooks
        </Button>
        {!canManage ? (
          <p className="text-xs text-muted-foreground">
            Connecting requires an owner or admin account.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
