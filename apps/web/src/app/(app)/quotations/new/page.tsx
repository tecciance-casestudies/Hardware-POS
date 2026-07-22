'use client';

import { PageHeader } from '@/components/page-header';
import { QuotationBuilder } from '@/components/quotations/quotation-builder';

export default function NewQuotationPage() {
  // The builder claims the full content height (POS-style): the page header
  // lives inside its catalog column so the quotation panel can start at the
  // top, just below the app header.
  return (
    <div className="h-full min-h-0">
      <QuotationBuilder
        mode="create"
        header={
          <PageHeader
            title="New quotation"
            description="Build a priced offer for a customer. Totals are calculated on the server."
          />
        }
      />
    </div>
  );
}
