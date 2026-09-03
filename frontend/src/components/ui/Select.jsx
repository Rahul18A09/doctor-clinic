import { forwardRef, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

function mergeRefs(...refs) {
  return (node) => {
    refs.forEach((ref) => {
      if (!ref) return
      if (typeof ref === 'function') ref(node)
      else ref.current = node
    })
  }
}

const TRIGGER_CLASS =
  'flex w-full items-center justify-between gap-2 rounded-xl border border-primary-200 bg-card px-3 py-2 text-left text-sm text-foreground shadow-sm transition-all hover:border-primary-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/25'

const MENU_MAX_HEIGHT = 240

function isEmptyValue(value) {
  return value === '' || value == null
}

function getMenuStyle(trigger) {
  const rect = trigger.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const gap = 4
  const inset = 8

  let width = rect.width
  let left = rect.left
  if (left + width > vw - inset) left = Math.max(inset, vw - width - inset)
  if (left < inset) {
    left = inset
    width = Math.min(width, vw - inset * 2)
  }

  const spaceBelow = vh - rect.bottom - gap - inset
  const spaceAbove = rect.top - gap - inset
  const openUp = spaceBelow < 160 && spaceAbove > spaceBelow
  const available = Math.max(96, openUp ? spaceAbove : spaceBelow)

  return {
    position: 'fixed',
    left,
    width,
    maxHeight: Math.min(MENU_MAX_HEIGHT, available),
    zIndex: 80,
    ...(openUp ? { bottom: vh - rect.top + gap } : { top: rect.bottom + gap }),
  }
}

export const Select = forwardRef(function Select(
  {
    label,
    id,
    error,
    options = [],
    placeholder = 'Select...',
    className = '',
    value,
    defaultValue,
    onChange,
    onBlur,
    name,
    disabled = false,
    ...props
  },
  ref,
) {
  const autoId = useId()
  const selectId = id || autoId
  const triggerId = `${selectId}-trigger`
  const nativeRef = useRef(null)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const listRef = useRef(null)
  const isControlled = value !== undefined
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState(null)
  const [selected, setSelected] = useState(() => value ?? defaultValue ?? '')

  useEffect(() => {
    if (isControlled) setSelected(value ?? '')
  }, [isControlled, value])

  useEffect(() => {
    if (isControlled) return
    const el = nativeRef.current
    if (el && el.value !== selected) setSelected(el.value)
  })

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null)
      return undefined
    }

    const update = () => {
      const trigger = triggerRef.current
      if (!trigger) return
      setMenuStyle(getMenuStyle(trigger))
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined

    const onPointerDown = (event) => {
      if (
        rootRef.current?.contains(event.target) ||
        listRef.current?.contains(event.target)
      ) {
        return
      }
      setOpen(false)
    }

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  const current = isControlled ? (value ?? '') : selected
  const listOptions = options.filter((opt) => !isEmptyValue(opt.value))
  const selectedOption = listOptions.find((opt) => String(opt.value) === String(current))
  const display = selectedOption?.label || placeholder
  const optionClass = (isActive) =>
    `flex w-full items-center rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
      isActive
        ? 'bg-primary-600 text-white'
        : 'text-foreground hover:bg-primary-50 hover:text-primary-700'
    }`

  const commit = (next) => {
    setSelected(next)
    const el = nativeRef.current
    if (el) {
      el.value = next
      el.dispatchEvent(new Event('change', { bubbles: true }))
    } else {
      onChange?.({ target: { name, value: next } })
    }
    setOpen(false)
  }

  const menu =
    open && menuStyle && typeof document !== 'undefined'
      ? createPortal(
          <ul
            ref={listRef}
            id={`${selectId}-listbox`}
            role="listbox"
            style={menuStyle}
            className="list-none overflow-y-auto overscroll-contain rounded-xl border border-primary-200 bg-card p-1 shadow-lg"
          >
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!current}
                className={optionClass(!current)}
                onClick={() => commit('')}
              >
                {placeholder}
              </button>
            </li>
            {listOptions.map((opt) => {
              const isActive = String(opt.value) === String(current)
              return (
                <li key={`${opt.value}-${opt.label}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={optionClass(isActive)}
                    onClick={() => commit(opt.value)}
                  >
                    {opt.label}
                  </button>
                </li>
              )
            })}
          </ul>,
          document.body,
        )
      : null

  return (
    <div className={`space-y-1 ${className}`} ref={rootRef}>
      {label && (
        <label htmlFor={triggerId} className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}

      <div className="relative">
        <select
          {...props}
          ref={mergeRefs(ref, nativeRef)}
          id={selectId}
          name={name}
          disabled={disabled}
          {...(isControlled ? { value: value ?? '' } : { defaultValue: defaultValue ?? '' })}
          onChange={(event) => {
            setSelected(event.target.value)
            onChange?.(event)
          }}
          onBlur={onBlur}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        >
          <option value="">{placeholder}</option>
          {listOptions.map((opt) => (
            <option key={`${opt.value}-${opt.label}`} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          id={triggerId}
          ref={triggerRef}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${selectId}-listbox`}
          onClick={() => !disabled && setOpen((prev) => !prev)}
          className={`${TRIGGER_CLASS} ${open ? 'border-primary-500 ring-2 ring-primary-500/25' : ''} ${
            error ? 'border-red-500' : ''
          } ${!selectedOption ? 'text-muted' : ''}`}
        >
          <span className="truncate">{display}</span>
          <svg
            className={`h-4 w-4 shrink-0 text-primary-600 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error.message}</p>}
      {menu}
    </div>
  )
})
