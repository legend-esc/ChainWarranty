/**
 * Shared button component for the dashboard.
 */
"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  loading = false,
  children,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "0.5rem 1.1rem",
    borderRadius: 6,
    fontWeight: 600,
    fontSize: "0.9rem",
    border: "none",
    cursor: disabled || loading ? "not-allowed" : "pointer",
    opacity: disabled || loading ? 0.6 : 1,
    transition: "opacity 0.15s",
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: { background: "#4f46e5", color: "#fff" },
    secondary: { background: "#f1f5f9", color: "#0f172a" },
    danger: { background: "#dc2626", color: "#fff" },
  };

  return (
    <button
      {...rest}
      disabled={disabled || loading}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {loading ? "…" : children}
    </button>
  );
}
