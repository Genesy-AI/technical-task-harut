import { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { leadFieldsQueryOptions } from '../api/queries/leadFields'
import { MessageTemplateModal } from './MessageTemplateModal'

// No @testing-library/react in this project, so the component is driven through the DOM directly.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const fields = [
  { key: 'firstName', label: 'First name' },
  { key: 'companyName', label: 'Company name' },
  { key: 'phoneNumber', label: 'Phone number' },
]

const setNativeValue = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const prototype = Object.getPrototypeOf(element) as HTMLInputElement | HTMLTextAreaElement
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
}

const pressKey = (element: Element, key: string) =>
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })

const flushTimers = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

describe('MessageTemplateModal field picker', () => {
  let container: HTMLDivElement
  let root: Root
  let onClose: ReturnType<typeof vi.fn>

  const textarea = () => document.querySelector('textarea') as HTMLTextAreaElement
  const toggle = () =>
    Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Insert field'))!
  const search = () => document.querySelector('input[aria-label="Search fields"]') as HTMLInputElement | null
  const optionLabels = () =>
    Array.from(document.querySelectorAll('[role="option"]')).map((o) => o.textContent)

  const openPicker = () => act(() => toggle().click())
  const typeSearch = (value: string) => act(() => setNativeValue(search()!, value))

  beforeEach(() => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(leadFieldsQueryOptions.queryKey, fields)
    onClose = vi.fn()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <MessageTemplateModal isOpen onClose={onClose} selectedLeadIds={[1]} selectedLeadsCount={1} />
        </QueryClientProvider>
      )
    )
    act(() => setNativeValue(textarea(), 'Hi  there'))
    textarea().setSelectionRange(3, 3)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('shows each field as label plus token and focuses the search box', () => {
    openPicker()

    expect(document.activeElement).toBe(search())
    expect(optionLabels()).toEqual([
      'First name{firstName}',
      'Company name{companyName}',
      'Phone number{phoneNumber}',
    ])
  })

  it('filters as the user types, then Enter inserts the field at the cursor', async () => {
    openPicker()
    typeSearch('phone')
    expect(optionLabels()).toEqual(['Phone number{phoneNumber}'])

    await pressKey(search()!, 'Enter')
    await flushTimers()

    expect(textarea().value).toBe('Hi {phoneNumber} there')
    expect(search()).toBeNull()
    expect(document.activeElement).toBe(textarea())
    expect(textarea().selectionStart).toBe('Hi {phoneNumber}'.length)
  })

  it('moves through results with the arrow keys', async () => {
    openPicker()
    await pressKey(search()!, 'ArrowDown')
    await pressKey(search()!, 'ArrowDown')
    await pressKey(search()!, 'ArrowUp')
    await pressKey(search()!, 'Enter')

    expect(textarea().value).toBe('Hi {companyName} there')
  })

  it('shows an empty state when nothing matches', () => {
    openPicker()
    typeSearch('zzz')

    expect(optionLabels()).toEqual([])
    expect(document.body.textContent).toContain('No fields match')
  })

  it('closes on Escape without closing the modal', async () => {
    openPicker()
    await pressKey(search()!, 'Escape')

    expect(search()).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    expect(textarea().value).toBe('Hi  there')
  })

  it('closes when clicking outside', () => {
    openPicker()
    act(() => {
      textarea().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })

    expect(search()).toBeNull()
  })

  it('closes when focus moves out of the picker (e.g. Tab)', () => {
    openPicker()
    act(() => {
      search()!.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: textarea() }))
    })

    expect(search()).toBeNull()
  })
})
