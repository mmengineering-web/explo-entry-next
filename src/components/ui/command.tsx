"use client";
import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

// Every typed word must appear in the item text. cmdk's default fuzzy match is too loose for a short tab list.
const wordFilter = (value: string, search: string) => {
  const v = value.toLowerCase();
  return search.toLowerCase().split(/\s+/).filter(Boolean).every(w => v.includes(w)) ? 1 : 0;
};

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return <CommandPrimitive data-slot="command" className={cn("flex h-full w-full flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground", className)} {...props} />;
}

function CommandDialog({ open, onOpenChange, children, title = "Perintah" }: { open: boolean; onOpenChange: (o: boolean) => void; children: React.ReactNode; title?: string }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-[var(--overlay)] backdrop-blur-[2px] data-[state=open]:animate-[m-rise_.2s_var(--ease-out)]" />
        <DialogPrimitive.Content
          className="fixed top-[12vh] left-1/2 z-[61] w-[min(34rem,calc(100vw-1.5rem))] -translate-x-1/2 overflow-hidden rounded-xl border bg-popover shadow-lg outline-none data-[state=open]:animate-[m-rise_.28s_var(--ease-spring)]"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <Command filter={wordFilter} className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">{children}</Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex items-center gap-2 border-b px-3">
      <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <CommandPrimitive.Input data-slot="command-input" className={cn("h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground", className)} {...props} />
    </div>
  );
}
function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return <CommandPrimitive.List className={cn("max-h-[50vh] overflow-y-auto p-1.5", className)} {...props} />;
}
function CommandEmpty(props: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty className="py-6 text-center text-sm text-muted-foreground" {...props} />;
}
function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return <CommandPrimitive.Group className={cn("overflow-hidden", className)} {...props} />;
}
function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn("flex min-h-11 cursor-default items-center gap-3 rounded-md px-3 text-sm outline-none select-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg]:size-4 [&_svg]:text-muted-foreground data-[selected=true]:[&_svg]:text-brand", className)}
      {...props}
    />
  );
}

export { Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem };
