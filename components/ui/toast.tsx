"use client";
import { Toast as T } from "radix-ui";
import { createContext, useContext, useState, type ReactNode } from "react";
import { X, Info } from "lucide-react";
const Context = createContext<(message: string) => void>(() => {});
export const useToast = () => useContext(Context);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState({ message: "", open: false, key: 0 });
  return (
    <Context.Provider
      value={(message) =>
        setToast((t) => ({ message, open: true, key: t.key + 1 }))
      }
    >
      <T.Provider duration={5000}>
        {children}
        <T.Root
          key={toast.key}
          open={toast.open}
          onOpenChange={(open) => setToast((t) => ({ ...t, open }))}
          className="toast"
        >
          <Info size={18} />
          <T.Title>{toast.message}</T.Title>
          <T.Close aria-label="Dismiss notification">
            <X size={16} />
          </T.Close>
        </T.Root>
        <T.Viewport className="toast-viewport" />
      </T.Provider>
    </Context.Provider>
  );
}
