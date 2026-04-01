import React from 'react';

type SkeletonVariant = 'course-wide' | 'resource-card' | 'stat-card';

interface SkeletonCardProps {
  variant?: SkeletonVariant;
}

const ShimmerBlock: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton-shimmer rounded-lg ${className}`} />
);

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  variant = 'resource-card',
}) => {
  if (variant === 'stat-card') {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-6 animate-pulse">
        <div className="flex items-center gap-4">
          <ShimmerBlock className="w-12 h-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <ShimmerBlock className="h-3 w-20" />
            <ShimmerBlock className="h-7 w-16" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'course-wide') {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden animate-pulse flex flex-col sm:flex-row">
        <ShimmerBlock className="sm:w-72 h-48 sm:h-auto rounded-none flex-shrink-0" />
        <div className="flex-1 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ShimmerBlock className="h-5 w-16 rounded-full" />
            <ShimmerBlock className="h-5 w-20 rounded-full" />
          </div>
          <ShimmerBlock className="h-6 w-3/4" />
          <ShimmerBlock className="h-4 w-full" />
          <ShimmerBlock className="h-4 w-2/3" />
          <div className="flex items-center gap-4 pt-2">
            <ShimmerBlock className="h-4 w-24" />
            <ShimmerBlock className="h-4 w-20" />
            <ShimmerBlock className="h-4 w-16" />
          </div>
          <div className="flex gap-2 pt-3">
            <ShimmerBlock className="h-9 w-20 rounded-xl" />
            <ShimmerBlock className="h-9 w-28 rounded-xl" />
            <ShimmerBlock className="h-9 w-16 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // resource-card (default)
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden animate-pulse">
      <div className="p-5 space-y-3">
        <div className="flex items-start gap-3">
          <ShimmerBlock className="w-11 h-11 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <ShimmerBlock className="h-5 w-3/4" />
            <ShimmerBlock className="h-4 w-full" />
            <ShimmerBlock className="h-4 w-1/2" />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <ShimmerBlock className="h-5 w-14 rounded-full" />
          <ShimmerBlock className="h-4 w-16" />
          <ShimmerBlock className="h-4 w-12" />
        </div>
        <div className="flex gap-2 pt-2 border-t border-slate-50">
          <ShimmerBlock className="h-8 w-20 rounded-lg" />
          <ShimmerBlock className="h-8 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

export const SkeletonGrid: React.FC<{
  count?: number;
  variant?: SkeletonVariant;
  columns?: string;
}> = ({ count = 6, variant = 'resource-card', columns }) => {
  const gridClass =
    columns ||
    (variant === 'course-wide'
      ? 'grid grid-cols-1 gap-4'
      : variant === 'stat-card'
      ? 'grid grid-cols-1 sm:grid-cols-3 gap-4'
      : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5');

  return (
    <div className={gridClass}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} variant={variant} />
      ))}
    </div>
  );
};
