import React from 'react';
import { motion } from 'motion/react';
import { SearchX, type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = SearchX,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className={`flex flex-col items-center justify-center py-20 text-center ${className}`}
  >
    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-100 to-indigo-50 flex items-center justify-center mb-6 shadow-sm">
      <Icon className="w-9 h-9 text-slate-400" />
    </div>
    <h3 className="text-xl font-extrabold text-slate-900">{title}</h3>
    {description && (
      <p className="text-sm text-slate-500 mt-2 max-w-sm leading-relaxed">
        {description}
      </p>
    )}
    {actionLabel && onAction && (
      <button
        onClick={onAction}
        className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200"
      >
        {actionLabel}
      </button>
    )}
  </motion.div>
);
