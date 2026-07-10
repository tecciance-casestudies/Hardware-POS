import { Users } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';

export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="Read-only cache from QuickBooks." />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Users className="h-6 w-6" />
          </span>
          <div>
            <p className="font-medium">No customers loaded</p>
            <p className="text-sm text-muted-foreground">
              Customers sync from QuickBooks and can be attached to a sale.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
