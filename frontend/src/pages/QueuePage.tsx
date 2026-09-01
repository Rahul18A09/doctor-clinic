import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { queueService } from '@/api/queue'
import clinicLogo from '@/assets/logo.svg'
import { Button } from '@/components/ui'
import type { PublicQueueStatus, QueueFetchState } from '@/types/queue'
import { ROUTES } from '@/utils/constants'
import { getApiErrorMessage } from '@/utils/errors'
import { formatTokenForUi } from '@/utils/formatToken'

const REFRESH_INTERVAL_MS = 5000

const CONTACT_NUMBERS = [
  { label: 'સંપર્ક નંબર 1', phone: '7984443901', color: 'green' as const },
  { label: 'સંપર્ક નંબર 2', phone: '8200863163', color: 'blue' as const },
]

const EMPTY_STATUS: PublicQueueStatus = {
  todays_token: '',
  current_token: '',
  current_patient_name: '',
}

function displayQueueToken(token: string): string {
  const formatted = formatTokenForUi(token).trim()
  return formatted || '—'
}

function formatBoardDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/\s+/g, '')}`
}

function readQueueStatus(payload: unknown): PublicQueueStatus | null {
  if (!payload || typeof payload !== 'object') return null

  const root = payload as Record<string, unknown>
  const nested =
    root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : null
  const source =
    nested && ('todays_token' in nested || 'current_token' in nested) ? nested : root

  if (!('todays_token' in source) && !('current_token' in source)) return null

  return {
    todays_token: String(source.todays_token ?? ''),
    current_token: String(source.current_token ?? ''),
    current_patient_name: String(source.current_patient_name ?? ''),
  }
}

export function QueuePage() {
  const [status, setStatus] = useState<PublicQueueStatus>(EMPTY_STATUS)
  const [state, setState] = useState<QueueFetchState>('loading')
  const [error, setError] = useState('')
  const [boardDate] = useState(() => formatBoardDate(new Date()))

  const fetchStatus = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setState((prev) => (prev === 'success' ? prev : 'loading'))
    }

    try {
      const response = await queueService.getStatus()
      const next = readQueueStatus(response.data)
      if (!next) {
        if (!silent) setState((prev) => (prev === 'success' ? prev : 'error'))
        return
      }

      setStatus(next)
      setError('')
      setState('success')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load queue status.'))
      setState((prev) => (prev === 'success' ? prev : 'error'))
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let inFlight = false

    const load = async (silent = false) => {
      if (cancelled || inFlight) return
      if (silent && document.hidden) return
      inFlight = true
      try {
        await fetchStatus({ silent })
      } finally {
        inFlight = false
      }
    }

    void load(false)
    const id = window.setInterval(() => {
      void load(true)
    }, REFRESH_INTERVAL_MS)

    const onVisibility = () => {
      if (!document.hidden) void load(true)
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [fetchStatus])

  const todaysToken = displayQueueToken(status.todays_token)
  const currentToken = displayQueueToken(status.current_token)
  const currentName = status.current_patient_name.trim()
    ? status.current_patient_name.trim().toUpperCase()
    : '—'

  return (
    <div
      className="flex h-svh max-h-svh flex-col overflow-hidden bg-white sm:h-auto sm:min-h-screen sm:max-h-none sm:overflow-visible sm:bg-[#f3f4f6] sm:px-3 sm:py-4"
      style={{ fontFamily: '"Nirmala UI", "Noto Sans Gujarati", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto flex min-h-0 w-full flex-1 flex-col bg-white pt-[env(safe-area-inset-top)] sm:max-w-[420px] sm:flex-none sm:overflow-hidden sm:rounded-2xl sm:border sm:border-slate-200 sm:border-t-4 sm:border-t-[#2e7d32] sm:pt-0 sm:shadow-sm">
        <div className="flex shrink-0 justify-center px-4 pb-1 pt-2 sm:px-6 sm:pb-2 sm:pt-5">
          <img
            src={clinicLogo}
            alt="Clinic logo"
            className="h-12 w-auto object-contain sm:h-[88px]"
          />
        </div>

        {state === 'error' && (
          <div className="mx-3 mb-2 shrink-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center sm:mx-4 sm:mb-3 sm:px-4 sm:py-3">
            <p className="text-sm font-medium text-red-700">{error}</p>
            <div className="mt-2 sm:mt-3">
              <Button onClick={() => void fetchStatus()}>Try again</Button>
            </div>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 pb-2 sm:gap-3 sm:px-4 sm:pb-5">
          <section className="flex min-h-0 flex-[1.15] flex-col items-center justify-center rounded-2xl bg-[#2e7d32] px-3 py-2.5 text-center text-white sm:flex-none sm:px-4 sm:pb-4 sm:pt-5">
            <p className="text-[13px] font-medium leading-tight sm:text-[15px] sm:leading-snug">
              આજના દિવસ ના ટોકન નંબર :
            </p>
            <p className="mt-1 font-sans text-[clamp(2.4rem,9.5vh,4.25rem)] font-extrabold leading-none tracking-wide tabular-nums sm:mt-2 sm:text-7xl">
              {todaysToken}
            </p>
            <div className="mt-2 flex justify-center sm:mt-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[12px] font-medium text-[#2e7d32] sm:text-[13px]">
                <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                {boardDate}
              </span>
            </div>
          </section>

          <section className="flex min-h-0 flex-[1.15] flex-col items-center justify-center rounded-2xl bg-[#1565c0] px-3 py-2.5 text-center text-white sm:flex-none sm:px-4 sm:py-5">
            <p className="text-[13px] font-medium leading-tight sm:text-[15px] sm:leading-snug">
              હાલમાં ચાલી રહેલો ટોકન નંબર :
            </p>
            <p className="mt-1 font-sans text-[clamp(2.4rem,9.5vh,4.25rem)] font-extrabold leading-none tracking-wide tabular-nums sm:mt-2 sm:text-7xl">
              {currentToken}
            </p>
            <div className="mx-8 mt-2 w-[min(12rem,70%)] border-t border-white/80 sm:mt-4" />
            <p className="mt-2 text-[13px] font-medium tracking-wide sm:mt-3 sm:text-[15px]">
              નામ : {currentName}
            </p>
          </section>

          <section className="flex shrink-0 items-start gap-2 rounded-xl bg-[#eef6ff] px-3 py-2 sm:gap-2.5 sm:rounded-2xl sm:bg-[#f3f4f6] sm:px-3.5 sm:py-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1565c0] text-[11px] font-bold text-white">
              i
            </span>
            <p className="text-[12px] leading-snug text-slate-700 sm:text-[13px] sm:leading-relaxed">
              <span className="font-bold">નોંધ :</span> એક વખત તમારો ટોકન નંબર આવી ગયા પછી તમે ચેકઅપ માટે પાછા આવો છો તો તમારે નવો ટોકન નંબર કઢાવવો પડશે. એના માટે જેટલી વાર લાગે તેટલી રાહ તમારે જોવી પડશે. એના માટે સ્ટાફ સાથે તકરાર કરવી નહીં.
            </p>
          </section>

          <section className="flex shrink-0 items-start gap-2 rounded-xl bg-[#e8f5e9] px-3 py-2 sm:gap-2.5 sm:rounded-2xl sm:px-3.5 sm:py-3">
            <svg
              className="mt-0.5 h-5 w-5 shrink-0 text-[#1b5e20]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
              />
            </svg>
            <p className="text-[12px] font-medium leading-snug text-[#1b5e20] sm:text-[13px] sm:leading-relaxed">
              નવી એપોઇન્ટમેન્ટ બુક કરાવવા માટે નીચે આપેલ નંબર પર કૉલ કરો.
            </p>
          </section>

          <div className="mt-auto flex shrink-0 flex-col gap-1.5">
            <div className="flex items-center gap-2 sm:gap-3 sm:pt-1">
              <span className="h-px flex-1 bg-slate-300" />
              <span className="text-xs font-semibold text-slate-600 sm:text-sm">સંપર્ક કરો</span>
              <span className="h-px flex-1 bg-slate-300" />
            </div>

            <div className="grid grid-cols-2">
              {CONTACT_NUMBERS.map((contact, index) => (
                <a
                  key={contact.phone}
                  href={telHref(contact.phone)}
                  className={`flex flex-col items-center px-1 py-1.5 text-center sm:py-2 ${
                    index === 0 ? 'border-r border-slate-200' : ''
                  }`}
                >
                  <span
                    className={`mb-1.5 flex h-8 w-8 items-center justify-center rounded-full text-white sm:mb-2 sm:h-9 sm:w-9 ${
                      contact.color === 'green' ? 'bg-[#2e7d32]' : 'bg-[#1565c0]'
                    }`}
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11.4 11.4 0 003.6.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.4 11.4 0 00.57 3.6 1 1 0 01-.25 1l-2.22 2.2z" />
                    </svg>
                  </span>
                  <span className="text-[12px] font-medium text-slate-600">{contact.label}</span>
                  <span className="mt-0.5 text-[13px] font-semibold text-slate-900">{contact.phone}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="mx-auto hidden max-w-[420px] text-center text-xs text-slate-400 sm:mt-4 sm:block">
        Staff login?{' '}
        <Link to={ROUTES.LOGIN} className="font-medium text-[#1565c0] hover:underline">
          Go to login
        </Link>
      </p>

      <p className="shrink-0 px-3 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1 text-center text-[11px] text-slate-400 sm:hidden">
        Staff login?{' '}
        <Link to={ROUTES.LOGIN} className="font-medium text-[#1565c0] hover:underline">
          Go to login
        </Link>
      </p>
    </div>
  )
}
