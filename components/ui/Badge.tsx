'use client';

interface BadgeProps {
  count: number;
  variant?: 'default' | 'active';
}

export default function Badge({ count, variant = 'default' }: BadgeProps) {
  if (count === 0) return null;

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-medium ${
        variant === 'active'
          ? 'bg-indigo-100 text-indigo-700'
          : 'bg-gray-200 text-gray-600'
      }`}
    >
      {count}
    </span>
  );
}
