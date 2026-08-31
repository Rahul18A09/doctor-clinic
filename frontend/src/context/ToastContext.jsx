import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ToastContext = createContext(null)

let toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message, type = 'success') => {
      const id = ++toastId
      setToasts((prev) => [...prev, { id, message, type }])
      setTimeout(() => removeToast(id), 4000)
    },
    [removeToast],
  )

  const showSuccess = useCallback(
    (message) => showToast(message, 'success'),
    [showToast],
  )

  const showError = useCallback(
    (message) => showToast(message, 'error'),
    [showToast],
  )

  const value = useMemo(
    () => ({ showSuccess, showError }),
    [showSuccess, showError],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed inset-x-4 top-4 z-50 flex flex-col gap-2 sm:inset-x-auto sm:right-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`animate-in max-w-full break-words rounded-xl px-4 py-3 text-sm font-medium shadow-lg sm:min-w-[280px] sm:max-w-sm ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
