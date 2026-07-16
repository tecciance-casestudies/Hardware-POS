'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { ArrowLeft, Printer } from 'lucide-react';

import { SaleA4Document } from '@/components/documents/sale-a4-document';
import { Button } from '@/components/ui/button';
import {
  getDocumentProfile,
  saleMetaFromSession,
  type DocumentProfile,
  type SaleDocumentMeta,
} from '@/lib/document-template-service';
import { fetchSale, type SaleDetail } from '@/lib/sales';
import { loadSession, type Session } from '@/lib/session-store';

/**
 * Shell-free A4 bill print/preview route. Rendered OUTSIDE the `(app)` group so
 * the sidebar/header never print. `?print=1` auto-opens the browser print dialog.
 */
export default function SalePrintPage() {
  const params = useParams<{ saleId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const saleId = params.saleId;
  const autoPrint = search.get('print') === '1';

  const [session, setSession] = React.useState<Session | null>(null);
  const [sale, setSale] = React.useState<SaleDetail | null>(null);
  const [profile, setProfile] = React.useState<DocumentProfile | null>(null);
  const [meta, setMeta] = React.useState<SaleDocumentMeta | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const s = loadSession();
    setSession(s);
    if (!s) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      try {
        const [saleData, prof] = await Promise.all([fetchSale(s, saleId), getDocumentProfile(s)]);
        if (!active) return;
        setSale(saleData);
        setProfile(prof);
        setMeta(saleMetaFromSession(s, prof));
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Could not load the sale');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [saleId]);

  // Auto-open the print dialog once the document is on screen.
  React.useEffect(() => {
    if (autoPrint && sale && profile) {
      const t = window.setTimeout(() => window.print(), 500);
      return () => window.clearTimeout(t);
    }
  }, [autoPrint, sale, profile]);

  if (!session && !loading) {
    return (
      <Centered>
        <p className="text-sm text-muted-foreground">Your session has expired.</p>
        <Button asChild className="mt-3">
          <Link href="/login">Go to login</Link>
        </Button>
      </Centered>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-100">
      {/* Toolbar — hidden when printing (.a4-toolbar) */}
      <div className="a4-toolbar sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
        <Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.back()}>
          Back
        </Button>
        <div className="text-sm font-medium text-muted-foreground">
          {sale ? `A4 Bill · ${sale.saleNumber}` : 'A4 Bill'}
        </div>
        <Button leftIcon={<Printer className="h-4 w-4" />} disabled={!sale} onClick={() => window.print()}>
          Print / Save as PDF
        </Button>
      </div>

      <div className="py-6">
        {loading ? (
          <Centered>
            <p className="text-sm text-muted-foreground">Preparing A4 bill…</p>
          </Centered>
        ) : error ? (
          <Centered>
            <p className="text-sm font-medium text-danger">{error}</p>
          </Centered>
        ) : sale && profile && meta ? (
          <div className="mx-auto w-fit bg-white shadow-lg print:shadow-none">
            <SaleA4Document sale={sale} profile={profile} meta={meta} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">{children}</div>;
}
