'use client'

import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  tone?: 'surface' | 'subtle' | 'strong'
}

const toneClasses: Record<NonNullable<SkeletonProps['tone']>, string> = {
  surface: 'bg-[rgba(255,255,255,0.07)]',
  subtle: 'bg-[rgba(255,255,255,0.05)]',
  strong: 'bg-[rgba(255,255,255,0.12)]'
}

export function Skeleton({ className, tone = 'surface', ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md',
        toneClasses[tone],
        className
      )}
      {...props}
    />
  )
}
