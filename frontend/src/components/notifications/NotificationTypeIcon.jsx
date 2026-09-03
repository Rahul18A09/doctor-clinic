const ICONS = {
  patient: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  ),
  token: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
    />
  ),
  queue: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
    />
  ),
  consultation: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  ),
  staff: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
    />
  ),
  system: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
    />
  ),
  returning: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  ),
  bed: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      d="M3 18V9a2 2 0 012-2h4a3 3 0 016 0h4a2 2 0 012 2v9M3 14h18M7 18v2M17 18v2"
    />
  ),
}

const TONES = {
  patient: 'bg-sky-100 text-sky-700',
  token: 'bg-amber-100 text-amber-700',
  queue: 'bg-amber-100 text-amber-700',
  consultation: 'bg-emerald-100 text-emerald-700',
  staff: 'bg-slate-100 text-slate-700',
  receptionist: 'bg-slate-100 text-slate-700',
  system: 'bg-violet-100 text-violet-700',
}

export function getNotificationTypeVisual(type, title) {
  const label = String(title || '').trim()
  const lower = label.toLowerCase()

  if (lower === 'new patient registered' || lower === 'new patient waiting') {
    return { icon: ICONS.patient, tone: 'bg-sky-100 text-sky-700', label }
  }
  if (lower === 'returning patient' || lower === 'returning patient waiting') {
    return { icon: ICONS.returning, tone: 'bg-emerald-100 text-emerald-700', label }
  }
  if (lower === 'bed assigned' || lower === 'bed released' || lower === 'bed marked for maintenance') {
    return { icon: ICONS.bed, tone: 'bg-sky-100 text-sky-700', label }
  }
  if (lower === 'admission required' || lower === 'admission pending') {
    return { icon: ICONS.bed, tone: 'bg-amber-100 text-amber-700', label }
  }

  return {
    icon: ICONS[type] || ICONS.system,
    tone: TONES[type] || TONES.system,
    label: label || type,
  }
}

export function NotificationTypeIcon({ type, title }) {
  const visual = getNotificationTypeVisual(type, title)
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${visual.tone}`}
      aria-hidden="true"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {visual.icon}
      </svg>
    </span>
  )
}

export function notificationSubjectText(item) {
  const parts = []
  if (item?.patient_name) parts.push(item.patient_name)
  if (item?.token_number) parts.push(`Token ${item.token_number}`)
  return parts.join(' · ')
}
