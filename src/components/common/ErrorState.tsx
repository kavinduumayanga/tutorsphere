import React from 'react';
import { motion } from 'motion/react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'We couldn\'t load the content. Please try again.',
  onRetry,
  className = '',
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className={`flex flex-col items-center justify-center py-20 text-center ${className}`}
  >
    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-rose-50 to-rose-100 flex items-center justify-center mb-6">
      <AlertCircle className="w-9 h-9 text-rose-400" />
    </div>
    <h3 className="text-xl font-extrabold text-slate-900">{title}</h3>
    <p className="text-sm text-slate-500 mt-2 max-w-sm leading-relaxed">
      {message}
    </p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors shadow-md"
      >
        <RefreshCw className="w-4 h-4" />
        Try Again
      </button>
    )}
  </motion.div>
);
