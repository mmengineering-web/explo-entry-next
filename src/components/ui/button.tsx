import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[transform,background,box-shadow,color] duration-200 outline-none select-none disabled:pointer-events-none disabled:opacity-50 active:scale-[.985] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-[color-mix(in_srgb,var(--primary)_86%,#fff)] to-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,.22),0_1px_2px_rgba(60,40,20,.2)] hover:-translate-y-px hover:shadow-md",
        outline: "border border-input bg-card text-foreground shadow-xs hover:bg-accent",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost: "text-foreground hover:bg-accent",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
      },
      size: {
        default: "h-[var(--control-h)] px-4",
        sm: "h-[var(--control-h-sm)] px-3",
        lg: "h-[var(--control-h-lg)] px-6 text-base",
        icon: "size-[var(--control-h)]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className, variant, size, asChild = false, ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
