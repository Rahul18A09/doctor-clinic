export function Icon({ children, className = 'h-[18px] w-[18px]' }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const profileIcons = {
  user: (
    <Icon>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Icon>
  ),
  mail: (
    <Icon>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </Icon>
  ),
  phone: (
    <Icon>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </Icon>
  ),
  idCard: (
    <Icon>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 14h2" />
      <path d="M12 14h6" />
    </Icon>
  ),
  shieldCheck: (
    <Icon>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  ),
  shield: (
    <Icon>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </Icon>
  ),
  wrench: (
    <Icon>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </Icon>
  ),
  clock: (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Icon>
  ),
  building: (
    <Icon>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </Icon>
  ),
  pencil: (
    <Icon>
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <path d="m15 5 4 4" />
    </Icon>
  ),
}

export function formatPhone(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '')
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
  }
  return mobile || '—'
}

export function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

export function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function apiMessage(err, fallback) {
  const data = err.response?.data
  const firstFieldError = data?.errors ? Object.values(data.errors).flat()[0] : null
  return firstFieldError || data?.message || err.message || fallback
}

export function StatusPill({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-green-600' : 'bg-red-600'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

export function SectionIcon({ children }) {
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-primary-600">
      {children}
    </span>
  )
}

export function LetterAvatar({ name }) {
  const initial = name?.trim()?.charAt(0)?.toUpperCase() || 'A'
  return (
    <div
      className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary-600 text-2xl font-bold text-white shadow-sm"
      aria-hidden="true"
    >
      {initial}
    </div>
  )
}

export function PersonalInfoRow({ icon, label, value, last = false }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 py-4 sm:gap-8 ${
        last ? '' : 'border-b border-slate-200'
      }`}
    >
      <div className="flex min-w-0 shrink-0 items-center gap-3">
        <span className="text-slate-400">{icon}</span>
        <span className="text-sm font-semibold text-slate-700">{label}</span>
      </div>
      <p className="min-w-0 text-right text-sm font-medium text-slate-900 break-words">{value}</p>
    </div>
  )
}

export function SecurityRow({ icon, label, detail, action, last = false }) {
  return (
    <div
      className={`flex items-center justify-between gap-2 py-4 sm:gap-4 ${
        last ? '' : 'border-b border-slate-200'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="shrink-0 text-slate-400">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-700">{label}</p>
          {detail ? <p className="mt-0.5 truncate text-sm tracking-widest text-slate-500">{detail}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
