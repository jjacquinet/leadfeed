'use client';

import { getAvatarColor, getInitials } from '@/lib/utils';

interface AvatarProps {
  firstName: string;
  lastName: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
};

export default function Avatar({ firstName, lastName, size = 'md' }: AvatarProps) {
  const initials = getInitials(firstName, lastName);
  const color = getAvatarColor(`${firstName} ${lastName}`);

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold text-white shrink-0`}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}
