import React, { useState, useCallback, useRef, useEffect, createContext, useContext } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

// ── Types ──

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (opts: Omit<ToastItem, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

// ── Context ──

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Return a no-op fallback so components don't break if used outside provider
    return {
      toast: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
};

// ── Single Toast ──

const VARIANT_CONFIG: Record<
  ToastVariant,
  { icon: React.ElementType; bg: string; border: string; iconColor: string; progressColor: string }
> = {
  success: {
    icon: CheckCircle,
    bg: 'bg-white',
    border: 'border-emerald-200',
    iconColor: 'text-emerald-500',
    progressColor: 'bg-emerald-500',
  },
  error: {
    icon: AlertCircle,
    bg: 'bg-white',
    border: 'border-rose-200',
    iconColor: 'text-rose-500',
    progressColor: 'bg-rose-500',
  },
  info: {
    icon: Info,
    bg: 'bg-white',
    border: 'border-indigo-200',
    iconColor: 'text-indigo-500',
    progressColor: 'bg-indigo-500',
  },
};

const ToastItemView: React.FC<{
  item: ToastItem;
  onDismiss: (id: string) => void;
}> = ({ item, onDismiss }) => {
  const config = VARIANT_CONFIG[item.variant];
  const Icon = config.icon;
  const duration = item.duration ?? 4000;

  const [progress, setProgress] = useState(100);
  const startRef = useRef(Date.now());
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining > 0) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        onDismiss(item.id);
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [duration, item.id, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }}
      transition={{ type: 'spring', damping: 22, stiffness: 280 }}
      className={`relative ${config.bg} border ${config.border} rounded-xl shadow-lg overflow-hidden min-w-[320px] max-w-[420px]`}
      style={{ boxShadow: 'var(--shadow-toast)' }}
    >
      <div className="flex items-start gap-3 p-4">
        <div className={`flex-shrink-0 mt-0.5 ${config.iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900">{item.title}</p>
          {item.message && (
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              {item.message}
            </p>
          )}
        </div>
        <button
          onClick={() => onDismiss(item.id)}
          className="flex-shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* Progress bar */}
      <div className="h-[3px] w-full bg-slate-100">
        <div
          className={`h-full ${config.progressColor} transition-none`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
};

// ── Provider ──

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((opts: Omit<ToastItem, 'id'>) => {
    const id = `toast-${++counterRef.current}-${Date.now()}`;
    setToasts((prev) => [...prev.slice(-4), { ...opts, id }]); // keep max 5
  }, []);

  const contextValue: ToastContextValue = {
    toast: addToast,
    success: (title, message) => addToast({ variant: 'success', title, message }),
    error: (title, message) => addToast({ variant: 'error', title, message }),
    info: (title, message) => addToast({ variant: 'info', title, message }),
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[400] flex flex-col gap-2.5 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItemView item={t} onDismiss={dismiss} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
