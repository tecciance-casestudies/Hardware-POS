'use client';

import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Store, tax, and receipt configuration." />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Store</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="currency">Currency</Label>
            <Input id="currency" defaultValue="USD" disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tax">Tax rate (%)</Label>
            <Input id="tax" defaultValue="0" disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="threshold">Discount approval threshold (%)</Label>
            <Input id="threshold" defaultValue="10" disabled />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="footer">Receipt footer</Label>
            <Input id="footer" defaultValue="Thank you for your purchase!" disabled />
          </div>
          <div className="sm:col-span-2">
            <Button disabled>Save changes</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
