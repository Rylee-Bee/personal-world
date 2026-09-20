/**
 * WorldButton — Accessible button primitive.
 *
 * Built on React Aria's Button for keyboard, focus, and ARIA behavior.
 * Enforces accessibility contract §2.1 (≥44px hit area) and §2.4 (focus ring).
 */

import { Button, type ButtonProps } from "react-aria-components";

interface WorldButtonProps extends ButtonProps {
  variant?: "primary" | "secondary" | "ghost";
}

export function WorldButton({
  variant = "secondary",
  className,
  children,
  ...props
}: WorldButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-[var(--pw-radius-sm)] font-medium " +
    "transition-colors duration-150 " +
    "disabled:opacity-50 disabled:cursor-not-allowed " +
    "min-h-[var(--pw-targets-minimum)] min-w-[var(--pw-targets-minimum)] " +
    "px-[var(--pw-spacing-lg)] py-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)]";

  const variants: Record<string, string> = {
    primary:
      "bg-[var(--pw-accent-warm)] text-[var(--pw-surface-void)] " +
      "hover:brightness-110 " +
      "active:brightness-90",
    secondary:
      "bg-[var(--pw-surface-panel)] text-[var(--pw-text-primary)] " +
      "border border-[var(--pw-border-subtle)] " +
      "hover:bg-[var(--pw-surface-elevated)] " +
      "active:bg-[var(--pw-surface-hull)]",
    ghost:
      "bg-transparent text-[var(--pw-text-secondary)] " +
      "hover:bg-[var(--pw-accent-warm_soft)] hover:text-[var(--pw-text-primary)] " +
      "active:bg-[var(--pw-accent-teal_soft)]",
  };

  return (
    <Button
      className={`${base} ${variants[variant]} ${className ?? ""}`}
      {...props}
    >
      {children}
    </Button>
  );
}
