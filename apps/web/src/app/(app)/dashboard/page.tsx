'use client';

import Link from 'next/link';
import { DollarSign, Package, ReceiptText, RefreshCw } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';

const STATS = [
  { label: "Today's Sales", value: 'USD 0.00', icon: DollarSign },
  { label: 'Transactions', value: '0', icon: ReceiptText },
  { label: 'Products Cached', value: '10', icon: Package },
  { label: 'Pending Syncs', value: '0', icon: RefreshCw },
];

export default function DashboardPage() {
  const { session } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${session?.user.name ?? ''}`}
        description="Overview of your store activity."
        actions={
          <Link href="/pos" className={buttonVariants()}>
            New Sale
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <div className="text-sm text-muted-foreground">{s.label}</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight">{s.value}</div>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <s.icon className="h-5 w-5" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This is the front-end foundation. Screens use a mock session and sample data. Connect the
          NestJS API and QuickBooks to bring in live products, sales, and sync status.
        </CardContent>
      </Card>
    </div>
  );
}
