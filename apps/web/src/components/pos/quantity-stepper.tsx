'use client';

import { Minus, Plus } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';

/**
 * Quantity control shared by the POS cart and the quotation builder: −/+
 * steppers plus a directly-typeable field, so a large quantity can be entered
 * without clicking up one at a time. The input keeps its own text state while
 * editing (allowing a transient empty value) and commits a whole number ≥ 1 on
 * blur/Enter, reverting if invalid. When `max` is set (e.g. remaining stock),
 * the value can't be raised above it and the + button disables at the cap.
 */
export function QuantityStepper({
  quantity,
  max,
  onDecrement,
  onIncrement,
  onSet,
}: {
  quantity: number;
  /** Upper bound (e.g. stock cap). Undefined = no cap. */
  max?: number;
  onDecrement: () => void;
  onIncrement: () => void;
  onSet: (quantity: number) => void;
}) {
  const [text, setText] = React.useState(String(quantity));

  // Re-sync when the quantity changes elsewhere (the +/- buttons, catalog refresh).
  React.useEffect(() => setText(String(quantity)), [quantity]);

  const atMax = max != null && quantity >= max;

  const commit = () => {
    let n = Math.floor(Number(text));
    if (text.trim() !== '' && Number.isFinite(n) && n >= 1) {
      if (max != null) n = Math.min(n, max); // clamp typed value to the cap
      if (n !== quantity) onSet(n);
      else setText(String(quantity)); // normalise (e.g. "03" → "3", over-max → cap)
    } else {
      setText(String(quantity)); // revert empty/invalid
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        aria-label="Decrease quantity"
        onClick={onDecrement}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <input
        type="text"
        inputMode="numeric"
        aria-label="Quantity"
        value={text}
        onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ''))}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
            e.currentTarget.blur();
          }
        }}
        className="h-9 w-12 rounded-lg border border-border bg-surface text-center text-sm font-semibold tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        aria-label="Increase quantity"
        onClick={onIncrement}
        disabled={atMax}
        title={atMax ? 'No more stock available' : undefined}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
