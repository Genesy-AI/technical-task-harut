import { FC, FocusEvent, KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { leadFieldsQueryOptions } from '../api/queries/leadFields'

interface FieldPickerProps {
  onSelect: (fieldKey: string) => void
}

export const FieldPicker: FC<FieldPickerProps> = ({ onSelect }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const fields = useQuery(leadFieldsQueryOptions)
  // Unique per instance, so ARIA references stay correct if more than one picker is mounted.
  const listboxId = useId()
  const optionId = (key: string) => `${listboxId}-${key}`

  const term = search.trim().toLowerCase()
  const matches = (fields.data ?? []).filter(
    (field) => field.label.toLowerCase().includes(term) || field.key.toLowerCase().includes(term)
  )
  const activeField = matches[activeIndex]

  const open = () => {
    setSearch('')
    setActiveIndex(0)
    setIsOpen(true)
  }

  const select = (fieldKey: string) => {
    setIsOpen(false)
    onSelect(fieldKey)
  }

  useEffect(() => {
    if (!isOpen) return

    const handleMouseDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isOpen])

  useEffect(() => {
    // scrollIntoView is missing in jsdom.
    listRef.current?.children[activeIndex]?.scrollIntoView?.({ block: 'nearest' })
  }, [activeIndex])

  // Tabbing away closes the list; a click on an option has no relatedTarget, so it isn't cut off before it lands.
  const handleBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) setIsOpen(false)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((index) => Math.min(index + 1, Math.max(matches.length - 1, 0)))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((index) => Math.max(index - 1, 0))
        break
      case 'Enter':
        // The picker sits inside the template form; Enter must not submit it.
        e.preventDefault()
        if (activeField) select(activeField.key)
        break
      case 'Escape':
        // Keeps the modal's document-level Escape handler from closing the whole modal.
        e.stopPropagation()
        setIsOpen(false)
        toggleRef.current?.focus()
        break
    }
  }

  return (
    <div ref={containerRef} onBlur={handleBlur} className="relative inline-block">
      <button
        ref={toggleRef}
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors"
      >
        Insert field
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 z-20 mt-1 w-72 bg-white border border-gray-200 rounded-md shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search fields..."
              role="combobox"
              aria-label="Search fields"
              aria-expanded
              aria-controls={listboxId}
              aria-activedescendant={activeField ? optionId(activeField.key) : undefined}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {fields.isLoading ? (
            <p className="px-3 py-2 text-sm text-gray-500">Loading fields...</p>
          ) : fields.isError ? (
            <div className="px-3 py-2 text-sm text-red-600">
              Couldn't load fields.{' '}
              <button
                type="button"
                onClick={() => fields.refetch()}
                className="font-medium underline hover:text-red-700"
              >
                Retry
              </button>
            </div>
          ) : matches.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">No fields match</p>
          ) : (
            <ul
              ref={listRef}
              id={listboxId}
              role="listbox"
              // Not a Tab stop: focus stays in the search box and options are reached via aria-activedescendant.
              tabIndex={-1}
              className="max-h-60 overflow-auto py-1"
            >
              {matches.map((field, index) => (
                <li
                  key={field.key}
                  id={optionId(field.key)}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => select(field.key)}
                  className={`flex justify-between gap-3 px-3 py-1.5 text-sm cursor-pointer ${
                    index === activeIndex ? 'bg-blue-50 text-blue-900' : 'text-gray-900'
                  }`}
                >
                  <span>{field.label}</span>
                  <span className="font-mono text-xs text-gray-500">{`{${field.key}}`}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
