'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastOptions {
  title?: string;
  message: string;
  tone?: ToastTone;
  durationMs?: number;
}

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

interface Toast extends Required<ToastOptions> {
  id: number;
}

interface ConfirmState extends Required<ConfirmOptions> {
  resolve: (value: boolean) => void;
}

interface FeedbackContextValue {
  notify: (options: string | ToastOptions) => void;
  confirm: (options: string | ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

function normalizeToastOptions(options: string | ToastOptions): Required<ToastOptions> {
  if (typeof options === 'string') {
    return {
      title: '',
      message: options,
      tone: 'info',
      durationMs: 4000,
    };
  }

  return {
    title: options.title || '',
    message: options.message,
    tone: options.tone || 'info',
    durationMs: options.durationMs ?? 4000,
  };
}

function normalizeConfirmOptions(
  options: string | ConfirmOptions
): Required<Omit<ConfirmOptions, 'message'>> & { message: string } {
  if (typeof options === 'string') {
    return {
      title: 'Please confirm',
      message: options,
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      tone: 'default',
    };
  }

  return {
    title: options.title || 'Please confirm',
    message: options.message,
    confirmLabel: options.confirmLabel || 'Confirm',
    cancelLabel: options.cancelLabel || 'Cancel',
    tone: options.tone || 'default',
  };
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  useEffect(() => {
    if (!confirmState) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        confirmState.resolve(false);
        setConfirmState(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmState]);

  const notify = (options: string | ToastOptions) => {
    const toast = normalizeToastOptions(options);
    const id = Date.now() + Math.floor(Math.random() * 1000);

    setToasts((current) => [...current, { ...toast, id }]);

    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, toast.durationMs);
  };

  const confirm = (options: string | ConfirmOptions) =>
    new Promise<boolean>((resolve) => {
      const normalized = normalizeConfirmOptions(options);
      setConfirmState({
        ...normalized,
        resolve,
      });
    });

  const dismissToast = (toastId: number) => {
    setToasts((current) => current.filter((item) => item.id !== toastId));
  };

  const resolveConfirm = (value: boolean) => {
    if (!confirmState) {
      return;
    }

    confirmState.resolve(value);
    setConfirmState(null);
  };

  return (
    <FeedbackContext.Provider value={{ notify, confirm }}>
      {children}

      {confirmState && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 px-4">
          <div className="w-full max-w-md rounded-3xl border border-futurex-line bg-futurex-surface p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            <div className="mb-2 text-xl font-serif text-futurex-ink">
              {confirmState.title}
            </div>
            <p className="text-sm leading-6 text-futurex-muted">
              {confirmState.message}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => resolveConfirm(false)}
                className="rounded-full border border-futurex-line px-4 py-2 text-sm font-medium text-futurex-muted transition hover:border-futurex-gold hover:text-futurex-ink"
              >
                {confirmState.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => resolveConfirm(true)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  confirmState.tone === 'danger'
                    ? 'bg-rose-700 text-white hover:bg-rose-600'
                    : 'bg-futurex-gold text-futurex-bg hover:opacity-90'
                }`}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4 sm:justify-end">
        <div className="flex w-full max-w-md flex-col gap-3">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.35)] ${
                toast.tone === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/12'
                  : toast.tone === 'error'
                    ? 'border-rose-500/30 bg-rose-500/12'
                    : 'border-futurex-gold-border bg-futurex-surface'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  {toast.title && (
                    <div className="text-sm font-semibold text-futurex-ink">
                      {toast.title}
                    </div>
                  )}
                  <div className="text-sm leading-6 text-futurex-muted">
                    {toast.message}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="text-xs uppercase tracking-[0.16em] text-futurex-muted transition hover:text-futurex-ink"
                >
                  Close
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);

  if (!context) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }

  return context;
}
