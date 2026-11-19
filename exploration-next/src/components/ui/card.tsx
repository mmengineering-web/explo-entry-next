import * as React from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "relative flex flex-col gap-4 rounded-xl border bg-card p-[var(--card-pad)] text-card-foreground shadow-sm [box-shadow:inset_0_1px_0_var(--surface-hi),var(--shadow-sm)]",
        className,
      )}
      {...props}
    />
  );
}
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("flex flex-col gap-1", className)} {...props} />;
}
function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2 data-slot="card-title" className={cn("flex items-center gap-2 text-lg font-semibold leading-tight before:h-[1.05em] before:w-1.5 before:rounded-full before:bg-primary", className)} {...props} />
  );
}
function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="card-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("flex flex-col gap-4", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent };
