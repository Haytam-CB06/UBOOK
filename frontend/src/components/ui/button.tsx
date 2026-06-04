import type { ButtonHTMLAttributes } from "react";

import clsx from "clsx";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "md" | "lg";

export function buttonStyles(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  return clsx(
    "inline-flex items-center justify-center rounded-md font-semibold transition duration-200 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60",
    size === "lg" ? "h-12 px-5 text-sm sm:text-base" : "h-10 px-4 text-sm",
    variant === "primary" &&
      "bg-brand-600 text-white shadow-float hover:bg-brand-700",
    variant === "secondary" &&
      "border border-brand-200 bg-white text-brand-700 hover:border-brand-300 hover:bg-brand-50",
    variant === "ghost" &&
      "bg-transparent text-ink hover:bg-slate-100"
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return <button type={type} className={clsx(buttonStyles(variant, size), className)} {...props} />;
}
