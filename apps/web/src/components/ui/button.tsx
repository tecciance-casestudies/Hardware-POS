import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * The single button primitive for the whole app. Semantic variants (one job each),
 * a fixed size scale with touch-friendly heights, plus loading / icon / full-width
 * affordances so call sites never hand-roll spinners or ad-hoc heights.
 *
 * Backwards-compatible aliases are kept so existing call sites keep working:
 *   variant: `danger` → destructive
 *   size:    `default` → md, `icon` → icon-md
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors whitespace-nowrap ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ' +
    'disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active shadow-sm',
        secondary: 'bg-muted text-foreground hover:bg-border',
        outline: 'border border-border bg-surface text-foreground hover:bg-muted',
        ghost: 'text-foreground hover:bg-muted',
        destructive: 'bg-danger text-primary-foreground hover:bg-danger-hover shadow-sm',
        danger: 'bg-danger text-primary-foreground hover:bg-danger-hover shadow-sm', // alias of destructive
        success: 'bg-success text-primary-foreground hover:bg-success-hover shadow-sm',
        warning: 'bg-warning text-primary-foreground hover:bg-warning-hover shadow-sm',
        link: 'px-0 text-primary underline-offset-4 shadow-none hover:underline',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-5 text-sm',
        lg: 'h-14 px-8 text-base',
        xl: 'h-[3.75rem] px-8 text-base', // 60px — POS / Payment main action
        default: 'h-11 px-5 text-sm', // alias of md
        'icon-sm': 'h-9 w-9',
        'icon-md': 'h-11 w-11',
        'icon-lg': 'h-14 w-14',
        icon: 'h-11 w-11', // alias of icon-md
      },
      fullWidth: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'>,
    ButtonVariantProps {
  /** Render a spinner, hide the left icon, and disable the button. */
  isLoading?: boolean;
  /** Icon shown before the label (replaced by the spinner while loading). */
  leftIcon?: React.ReactNode;
  /** Icon shown after the label. */
  rightIcon?: React.ReactNode;
  /**
   * Render the single child element instead of a `<button>`, merging button
   * classes onto it. Use for links: `<Button asChild><Link href=…/></Button>`.
   */
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      isLoading = false,
      leftIcon,
      rightIcon,
      asChild = false,
      type,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const classes = cn(buttonVariants({ variant, size, fullWidth }), className);

    // asChild: clone the provided element (e.g. next/link) with merged classes.
    // Kept intentionally minimal — no spinner/icon injection on this path.
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string }>;
      return React.cloneElement(child, {
        className: cn(classes, child.props.className),
        ...props,
      });
    }

    return (
      <button
        ref={ref}
        // Default to a non-submitting button so a Button inside a <form> never
        // submits by accident; callers opt into type="submit" explicitly.
        type={type ?? 'button'}
        className={classes}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          leftIcon
        )}
        {children}
        {rightIcon}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
