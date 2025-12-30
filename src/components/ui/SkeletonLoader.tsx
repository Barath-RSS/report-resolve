import { cn } from '@/lib/utils';

interface SkeletonLoaderProps {
  className?: string;
  variant?: 'text' | 'card' | 'avatar' | 'button';
}

export function SkeletonLoader({ className, variant = 'text' }: SkeletonLoaderProps) {
  const baseClasses = 'animate-pulse bg-muted rounded';
  
  const variantClasses = {
    text: 'h-4 w-full',
    card: 'h-32 w-full rounded-lg',
    avatar: 'h-10 w-10 rounded-full',
    button: 'h-10 w-24 rounded-md',
  };

  return (
    <div className={cn(baseClasses, variantClasses[variant], className)} />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <div className="flex items-center space-x-4">
        <SkeletonLoader variant="avatar" />
        <div className="space-y-2 flex-1">
          <SkeletonLoader className="h-4 w-1/3" />
          <SkeletonLoader className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonLoader className="h-20" />
      <div className="flex space-x-2">
        <SkeletonLoader variant="button" />
        <SkeletonLoader variant="button" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex space-x-4 p-4 bg-muted/50 rounded-t-lg">
        <SkeletonLoader className="h-4 w-1/4" />
        <SkeletonLoader className="h-4 w-1/4" />
        <SkeletonLoader className="h-4 w-1/4" />
        <SkeletonLoader className="h-4 w-1/4" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex space-x-4 p-4 border-b border-border">
          <SkeletonLoader className="h-4 w-1/4" />
          <SkeletonLoader className="h-4 w-1/4" />
          <SkeletonLoader className="h-4 w-1/4" />
          <SkeletonLoader className="h-4 w-1/4" />
        </div>
      ))}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-6 space-y-2">
          <SkeletonLoader className="h-4 w-1/2" />
          <SkeletonLoader className="h-8 w-3/4" />
        </div>
      ))}
    </div>
  );
}
