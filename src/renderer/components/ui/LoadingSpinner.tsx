import { memo } from 'react'

const SIZE_CLASSES = {
  sm: 'w-6 h-6 border-2',
  md: 'w-10 h-10 border-3',
  lg: 'w-14 h-14 border-4'
} as const

interface LoadingSpinnerProps {
  size?: keyof typeof SIZE_CLASSES
  className?: string
}

export const LoadingSpinner = memo(function LoadingSpinner({
  size = 'md',
  className = ''
}: LoadingSpinnerProps) {
  return (
    <div
      className={`${SIZE_CLASSES[size]} border-accent border-t-transparent animate-spin ${className}`}
      style={{ borderRadius: '2px' }}
      role="status"
      aria-label="加载中"
    />
  )
})
