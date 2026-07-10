'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Store } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MOCK_USERS, useAuth } from '@/lib/auth';

const QUICK_LOGINS: { key: keyof typeof MOCK_USERS; label: string; hint: string }[] = [
  { key: 'owner', label: 'Owner', hint: 'Full access' },
  { key: 'manager', label: 'Manager', hint: 'Approves discounts' },
  { key: 'cashier', label: 'Cashier', hint: 'Sells & takes payment' },
  { key: 'accountant', label: 'Accountant', hint: 'Sync & QuickBooks' },
];

export default function LoginPage() {
  const { isAuthenticated, loginMock, loginWithEmail, loginWithPin } = useAuth();
  const router = useRouter();
  const [email, setEmail] = React.useState('owner@hardwarepos.test');
  const [password, setPassword] = React.useState('password123');
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  const go = () => router.replace('/dashboard');

  const tryApi = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      go();
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} — is the API running? You can use a demo login above.`
          : 'Login failed',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Store className="h-6 w-6" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Hardware POS</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to start selling</p>
        </div>

        <Card>
          <CardContent className="space-y-5 p-6">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Quick demo login
              </p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_LOGINS.map((q) => (
                  <button
                    key={q.key}
                    type="button"
                    onClick={() => {
                      loginMock(q.key);
                      go();
                    }}
                    className="rounded-xl border border-border bg-surface p-3 text-left transition-colors hover:border-primary hover:bg-brand-50"
                  >
                    <div className="text-sm font-semibold">{q.label}</div>
                    <div className="text-xs text-muted-foreground">{q.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              or use credentials
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <Button
                className="w-full"
                size="lg"
                disabled={busy}
                onClick={() => void tryApi(() => loginWithEmail(email, password))}
              >
                Sign in
              </Button>
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="pin">Cashier PIN</Label>
                <Input
                  id="pin"
                  inputMode="numeric"
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="lg"
                disabled={busy || pin.length < 4}
                onClick={() => void tryApi(() => loginWithPin(pin))}
              >
                PIN sign in
              </Button>
            </div>

            {error ? <p className="text-sm text-danger">{error}</p> : null}
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Demo logins work offline. Credential sign-in calls the API.
        </p>
      </div>
    </main>
  );
}
