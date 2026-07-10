import * as React from 'react';

import { PageHeader } from '@/components/page-header';
import { QuickBooksTabs } from '@/components/quickbooks/qb-tabs';
import { QuickBooksProvider } from '@/lib/quickbooks';

export default function QuickBooksLayout({ children }: { children: React.ReactNode }) {
  return (
    <QuickBooksProvider>
      <div className="space-y-6">
        <PageHeader
          title="QuickBooks"
          description="QuickBooks Online is the inventory and accounting source of truth."
        />
        <QuickBooksTabs />
        {children}
      </div>
    </QuickBooksProvider>
  );
}
