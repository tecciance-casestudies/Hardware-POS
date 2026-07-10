import { ReceiptText } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';

export default function SalesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Sales" description="Sales history and QuickBooks sync status." />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <ReceiptText className="h-6 w-6" />
          </span>
          <div>
            <p className="font-medium">No sales yet</p>
            <p className="text-sm text-muted-foreground">
              Completed sales and their sync status will appear here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
