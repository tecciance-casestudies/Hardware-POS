'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';

import { PageHeader } from '@/components/page-header';
import { QuotationBuilder } from '@/components/quotations/quotation-builder';
import { useAuth } from '@/lib/auth';
import { fetchQuotation, type QuotationDetail } from '@/lib/quotations';

export default function EditQuotationPage() {
  const { session } = useAuth();
  const params = useParams<{ id: string }>();
  const [quotation, setQuotation] = React.useState<QuotationDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!session) return;
    void fetchQuotation(session, params.id)
      .then(setQuotation)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load quotation'));
  }, [session, params.id]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!quotation) return <p className="text-sm text-muted-foreground">Loading…</p>;

  // A draft is edited in place; an issued quotation gets a new revision.
  const mode = quotation.status === 'DRAFT' ? 'edit' : 'revision';

  return (
    <div className="h-full min-h-0">
      <QuotationBuilder
        mode={mode}
        initial={quotation}
        header={
          <PageHeader
            title={mode === 'edit' ? `Edit ${quotation.revisionLabel}` : `Revise ${quotation.revisionLabel}`}
            description={
              mode === 'edit'
                ? 'Change items, quantities, prices, or discounts. The original is updated.'
                : 'Create a new revision — the previous version is preserved in history.'
            }
          />
        }
      />
    </div>
  );
}
