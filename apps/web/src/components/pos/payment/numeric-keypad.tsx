'use client';

import { CornerDownLeft, Delete } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn, formatMoney } from '@/lib/utils';

/**
 * Quick cash amounts derived from the amount due — the exact figure plus a few
 * sensible round-ups scaled to the transaction size (so a Rs. 5,156.60 sale
 * offers 5,200 / 5,500 / 6,000, never an irrelevant Rs. 500).
 */
export function computeQuickAmounts(total: number): number[] {
  const exact = Math.ceil(total);
  if (exact <= 0) return [];
  // Step scales with magnitude: 4-digit totals step by 100s, 5-digit by 1,000s…
  const digits = String(exact).length;
  const step = Math.pow(10, Math.max(1, digits - 2));
  const amounts = [exact];
  for (const factor of [1, 2, 5, 10]) {
    const rounded = Math.ceil((exact + 1) / (step * factor)) * (step * factor);
    if (!amounts.includes(rounded)) amounts.push(rounded);
    if (amounts.length >= 4) break;
  }
  return amounts.slice(0, 4);
}

/** Row of quick-cash buttons; the exact amount is highlighted and shows its label. */
export function QuickAmountButtons({
  total,
  selected,
  onPick,
}: {
  total: number;
  /** Currently-entered amount, so the matching quick button reads as active. */
  selected?: number;
  onPick: (amount: number) => void;
}) {
  const amounts = React.useMemo(() => computeQuickAmounts(total), [total]);
  if (amounts.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {amounts.map((amount, i) => {
        const isActive = selected != null && Math.abs(selected - amount) < 0.005;
        const isExact = i === 0;
        return (
          <button
            key={amount}
            type="button"
            onClick={() => onPick(amount)}
            aria-pressed={isActive}
            className={cn(
              'flex min-h-11 min-w-[5rem] flex-1 flex-col items-center justify-center rounded-xl border px-3 py-1.5 text-sm font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              isActive || isExact
                ? 'border-primary bg-brand-50 text-brand-700'
                : 'border-border text-foreground hover:bg-muted',
            )}
          >
            <span>{isExact ? 'Exact' : formatMoney(amount)}</span>
            {isExact ? (
              <span className="text-[10px] font-medium uppercase tracking-wide text-brand-600">
                {formatMoney(amount)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

const DIGIT_KEYS: { k: string; col: number; row: number }[] = [
  { k: '1', col: 1, row: 1 },
  { k: '2', col: 2, row: 1 },
  { k: '3', col: 3, row: 1 },
  { k: '4', col: 1, row: 2 },
  { k: '5', col: 2, row: 2 },
  { k: '6', col: 3, row: 2 },
  { k: '7', col: 1, row: 3 },
  { k: '8', col: 2, row: 3 },
  { k: '9', col: 3, row: 3 },
  { k: '.', col: 1, row: 4 },
  { k: '0', col: 2, row: 4 },
  { k: '00', col: 3, row: 4 },
];

/**
 * Touch keypad matching the approved layout: digits in a 3-wide block, a
 * backspace top-right, and a tall primary Enter/confirm key spanning the right
 * column. 56px targets, sized so it never pushes the action footer off screen.
 */
export function NumericKeypad({
  onPress,
  onEnter,
  enterDisabled,
}: {
  /** Receives a digit, '00', '.', or 'back'. */
  onPress: (key: string) => void;
  /** Fired by the Enter/confirm key (wired to complete the payment when valid). */
  onEnter?: () => void;
  enterDisabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-4 grid-rows-4 gap-2">
      {DIGIT_KEYS.map(({ k, col, row }) => (
        <Button
          key={k}
          variant="outline"
          onClick={() => onPress(k)}
          aria-label={k}
          className="h-14 text-lg font-semibold"
          style={{ gridColumnStart: col, gridRowStart: row }}
        >
          {k}
        </Button>
      ))}

      <Button
        variant="outline"
        onClick={() => onPress('back')}
        aria-label="Backspace"
        className="h-14"
        style={{ gridColumnStart: 4, gridRowStart: 1 }}
      >
        <Delete className="h-5 w-5" aria-hidden />
      </Button>

      <Button
        onClick={onEnter}
        disabled={enterDisabled || !onEnter}
        aria-label="Enter — complete payment"
        className="h-full"
        style={{ gridColumnStart: 4, gridRow: '2 / span 3' }}
      >
        <CornerDownLeft className="h-6 w-6" aria-hidden />
      </Button>
    </div>
  );
}
