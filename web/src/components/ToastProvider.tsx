// web/src/components/ToastProvider.tsx
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Toaster } from "react-hot-toast";

type Toast = { id: string; message: string };
type Ctx = { show: (message: string) => void };

const ToastCtx = createContext<Ctx>({ show: () => {} });

export function useToast() {
  return useContext(ToastCtx);
}

function uid() {
  return Math.random().toString(36).slice(2);
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, any>>({});

  const show = useCallback((message: string) => {
    const id = uid();
    setToasts((t) => [...t, { id, message }]);
    timers.current[id] = setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
      delete timers.current[id];
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach(clearTimeout);
    };
  }, []);

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="rounded-xl border border-zinc-300 bg-white/90 px-4 py-2 text-sm shadow-lg backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/90"
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
