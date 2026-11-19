import { MountainSnow } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("grid size-[2.1rem] shrink-0 place-items-center rounded-[.6rem] bg-gradient-to-br from-[color-mix(in_srgb,var(--primary)_82%,#fff)] to-primary text-primary-foreground shadow-sm", className)}>
      <MountainSnow className="size-[18px]" aria-hidden />
    </span>
  );
}
