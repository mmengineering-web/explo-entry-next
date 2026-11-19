"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "./ui/button";

type Opts = { title?: string; ok?: string; cancel?: string; danger?: boolean };
type Ask = (message: string, opts?: Opts) => Promise<boolean>;
const Ctx = createContext<Ask>(async () => false);
export const useConfirm = () => useContext(Ctx);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [st, setSt] = useState<{ message: string; opts: Opts } | null>(null);
  const resolve = useRef<((v: boolean) => void) | null>(null);
  const ask = useCallback<Ask>((message, opts = {}) => new Promise<boolean>(res => { resolve.current = res; setSt({ message, opts }); }), []);
  const done = (v: boolean) => { resolve.current?.(v); resolve.current = null; setSt(null); };
  return (
    <Ctx.Provider value={ask}>
      {children}
      <Dialog.Root open={!!st} onOpenChange={o => { if (!o) done(false); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-[m-rise_.18s_ease-out]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[91] w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover p-5 shadow-xl outline-none data-[state=open]:animate-[m-rise_.2s_ease-out]">
            <Dialog.Title className="text-base font-semibold">{st?.opts.title ?? "Konfirmasi"}</Dialog.Title>
            <Dialog.Description className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{st?.message}</Dialog.Description>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => done(false)}>{st?.opts.cancel ?? "Batal"}</Button>
              <Button variant={st?.opts.danger ? "destructive" : "default"} onClick={() => done(true)} autoFocus id="confirm-ok">{st?.opts.ok ?? "Lanjut"}</Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Ctx.Provider>
  );
}
