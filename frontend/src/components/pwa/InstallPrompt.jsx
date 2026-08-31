import { useEffect, useState } from 'react'
import { Button } from '@/components/ui'

const DISMISS_KEY = 'pwa-install-dismissed'

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

function isIosDevice() {
  const ua = window.navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState(null)
  const [iosHint, setIosHint] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (isStandalone()) return undefined

    const onPrompt = (event) => {
      event.preventDefault()
      setDeferred(event)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    if (isIosDevice()) setIosHint(true)

    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const dismiss = () => {
    setDismissed(true)
    setDeferred(null)
    setIosHint(false)
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  const install = async () => {
    if (!deferred) return
    deferred.prompt()
    await deferred.userChoice
    dismiss()
  }

  if (dismissed || isStandalone()) return null
  if (!deferred && !iosHint) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] z-40 px-3 lg:bottom-4">
      <div className="pointer-events-auto mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-border bg-card p-3 shadow-lg">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Install Doctor Clinic</p>
          <p className="mt-0.5 text-xs text-muted">
            {deferred
              ? 'Add this app to your home screen for faster access.'
              : 'On iPhone or iPad, tap Share, then Add to Home Screen.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {deferred && (
            <Button type="button" size="sm" onClick={install}>
              Install
            </Button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-surface hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
