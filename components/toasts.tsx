'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Toast = { id: number; message: string };

const TOAST_MS = 4500;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string) => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((prev) => [...prev, { id, message }]);
  }, []);

  return { toasts, showToast, dismissToast };
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <li className="pointer-events-auto flex items-start gap-3 rounded-xl bg-raised px-4 py-3 text-sm shadow-xl ring-1 ring-line">
      <span className="flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="-my-2 -mr-2 flex size-9 items-center justify-center text-muted hover:text-text"
      >
        ✕
      </button>
    </li>
  );
}

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <ul
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 mx-auto flex w-full max-w-sm flex-col gap-2 px-4"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </ul>
  );
}
