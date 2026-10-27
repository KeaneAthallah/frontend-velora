"use client";

import * as React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "warning" | "error";

type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type Toast = ToastInput & { id: string; exiting?: boolean };

interface ToastContextValue {
  push: (toast: ToastInput) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const timers = React.useRef(new Map<string, number>());

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.map((toast) => (toast.id === id ? { ...toast, exiting: true } : toast)));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
      const pending = timers.current.get(id);
      if (pending) window.clearTimeout(pending);
      timers.current.delete(id);
    }, 180);
  }, []);

  const push = React.useCallback(
    (input: ToastInput) => {
      const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { ...input, id }]);
      const timer = window.setTimeout(() => dismiss(id), input.duration ?? 4800);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  React.useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((timer) => window.clearTimeout(timer));
      map.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ push, dismiss }}>
      {children}
      <div className="toasts">
        {toasts.map((toast) => {
          const Icon =
            toast.variant === "success"
              ? CheckCircle2
              : toast.variant === "error"
                ? AlertCircle
                : toast.variant === "warning"
                  ? AlertTriangle
                  : Info;
          return (
            <div
              key={toast.id}
              className={cn("toast")}
              data-variant={toast.variant ?? "default"}
              data-exiting={toast.exiting ? "true" : undefined}
              role={toast.variant === "error" ? "alert" : "status"}
            >
              <span className="toast__icon">
                <Icon aria-hidden="true" />
              </span>
              <div className="toast__copy">
                <span className="toast__title">{toast.title}</span>
                {toast.description && <span className="toast__desc">{toast.description}</span>}
              </div>
              <button
                type="button"
                className="toast__close"
                aria-label="Dismiss notification"
                onClick={() => dismiss(toast.id)}
              >
                <X aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

const fallback: ToastContextValue = {
  push: () => {},
  dismiss: () => {},
};

export function useToast() {
  return React.useContext(ToastContext) ?? fallback;
}
