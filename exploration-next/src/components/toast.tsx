"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

type T = { id: number; text: string; kind: "ok" | "err" };
const Ctx = createContext<(text: string, kind?: "ok" | "err") => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((text: string, kind: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setItems(a => [...a, { id, text, kind }]);
    setTimeout(() => setItems(a => a.filter(x => x.id !== id)), 4200);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+var(--safe-b)+.5rem)] z-[80] flex flex-col items-center gap-2 px-3 lg:bottom-6" role="status" aria-live="polite">
        <AnimatePresence>
          {items.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              className="pointer-events-auto flex max-w-md items-center gap-2 rounded-lg border bg-popover px-4 py-3 text-sm shadow-lg"
            >
              {t.kind === "ok" ? <CheckCircle2 className="size-4 text-success" /> : <AlertTriangle className="size-4 text-danger" />}
              <span>{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
