import React from 'react';

// '시소 그림'을 나타내는 아이콘 (lucide 아이콘과 같은 선 굵기·크기 규칙)
export function SeesawIcon({ size = 24, className, strokeWidth = 2 }: { size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 15 L22 10" />
      <path d="M12 12.5 L8.5 19 H15.5 Z" />
      <circle cx="4.5" cy="11.6" r="1.6" />
      <circle cx="19.5" cy="7.8" r="1.6" />
      <path d="M4 21 H20" />
    </svg>
  );
}
