import { useCallback, type ChangeEvent } from 'react'
import { SearchIcon, CloseIcon } from '../icons'

interface SearchInputProps {
  placeholder?: string
  value: string
  onChange: (next: string) => void
  onClear?: () => void
  className?: string
  size?: 'sm' | 'md'
  'aria-label'?: string
}

export function SearchInput({
  placeholder,
  value,
  onChange,
  onClear,
  className,
  size = 'sm',
  'aria-label': ariaLabel
}: SearchInputProps) {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value)
    },
    [onChange]
  )

  const handleClear = useCallback(() => {
    if (onClear) {
      onClear()
    } else {
      onChange('')
    }
  }, [onChange, onClear])

  const iconSize = size === 'md' ? 18 : 16
  const sizeClass = size === 'md' ? 'py-2.5 text-sm' : 'py-2 text-sm'
  const showClear = value.length > 0

  return (
    <div className={`relative w-full ${className ?? ''}`}>
      <SearchIcon
        size={iconSize}
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
      />
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={handleChange}
        aria-label={ariaLabel ?? placeholder}
        className={`input-sm w-full pl-10 pr-9 ${sizeClass}`}
        data-testid="search-input"
      />
      {showClear && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="清除搜索"
          title="清除搜索"
          data-testid="search-input-clear"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1 radius-sm transition-colors"
        >
          <CloseIcon size={14} />
        </button>
      )}
    </div>
  )
}
