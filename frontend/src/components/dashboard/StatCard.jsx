const ICON_BOX = {
  primary: 'bg-primary-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  blue: 'bg-sky-500',
}

const TITLE_COLOR = {
  primary: 'text-primary-600',
  green: 'text-emerald-600',
  amber: 'text-amber-600',
  blue: 'text-sky-600',
}

const WATERMARK_COLOR = {
  primary: 'text-primary-400',
  green: 'text-emerald-400',
  amber: 'text-amber-400',
  blue: 'text-sky-400',
}

const GRADIENT = {
  primary: 'from-primary-500 to-primary-600',
  green: 'from-emerald-500 to-emerald-600',
  amber: 'from-amber-500 to-amber-600',
  blue: 'from-sky-500 to-sky-600',
}

function PeopleGroupIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  )
}

function ClockIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

function ClipboardIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      />
    </svg>
  )
}

function CheckIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

function PeopleWatermark() {
  return (
    <svg viewBox="0 0 140 110" fill="currentColor" aria-hidden="true" className="h-full w-full">
      <circle cx="42" cy="28" r="12" />
      <path d="M18 78c0-16 11-26 24-26s24 10 24 26v6H18z" />
      <circle cx="78" cy="24" r="13" />
      <path d="M52 82c0-18 12-29 26-29s26 11 26 29v8H52z" />
      <circle cx="110" cy="30" r="11" />
      <path d="M90 80c0-14 9-24 20-24s20 10 20 24v8H90z" />
    </svg>
  )
}

function WaitingWatermark() {
  return (
    <svg viewBox="0 0 140 110" fill="currentColor" aria-hidden="true" className="h-full w-full">
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <circle cx="108" cy="20" r="12" />
        <path d="M108 14v7l5 3" />
      </g>
      <g transform="translate(10 36)">
        <rect x="10" y="0" width="20" height="26" rx="3" />
        <rect x="6" y="26" width="28" height="10" rx="2" />
        <rect x="10" y="36" width="5" height="16" rx="1" />
        <rect x="25" y="36" width="5" height="16" rx="1" />
      </g>
      <g transform="translate(48 32)">
        <rect x="10" y="0" width="22" height="28" rx="3" />
        <rect x="6" y="28" width="30" height="11" rx="2" />
        <rect x="10" y="39" width="5" height="18" rx="1" />
        <rect x="27" y="39" width="5" height="18" rx="1" />
      </g>
      <g transform="translate(88 36)">
        <rect x="10" y="0" width="20" height="26" rx="3" />
        <rect x="6" y="26" width="28" height="10" rx="2" />
        <rect x="10" y="36" width="5" height="16" rx="1" />
        <rect x="25" y="36" width="5" height="16" rx="1" />
      </g>
    </svg>
  )
}

function ConsultationWatermark() {
  return (
    <svg viewBox="0 0 140 110" fill="none" stroke="currentColor" aria-hidden="true" className="h-full w-full">
      <rect x="38" y="16" width="58" height="78" rx="8" strokeWidth="3" />
      <path d="M54 16v-6h26v6" strokeWidth="3" strokeLinejoin="round" />
      <path d="M52 42h30M52 56h30M52 70h18" strokeWidth="3" strokeLinecap="round" />
      <circle cx="98" cy="78" r="14" fill="currentColor" stroke="none" />
      <path d="M92 78h12M98 72v12" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

function CompletedWatermark() {
  return (
    <svg viewBox="0 0 140 110" fill="none" stroke="currentColor" aria-hidden="true" className="h-full w-full">
      <rect x="32" y="18" width="62" height="80" rx="8" strokeWidth="2.4" />
      <path d="M48 18v-6h30v6" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M46 42h34M46 54h34M46 66h22" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="96" cy="78" r="16" fill="currentColor" stroke="none" />
      <path d="M88 78l6 6 12-12" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const VARIANT_THEME = {
  today: {
    color: 'primary',
    badge: PeopleGroupIcon,
    watermark: PeopleWatermark,
  },
  waiting: {
    color: 'amber',
    badge: ClockIcon,
    watermark: WaitingWatermark,
  },
  consultation: {
    color: 'blue',
    badge: ClipboardIcon,
    watermark: ConsultationWatermark,
  },
  completed: {
    color: 'green',
    badge: CheckIcon,
    watermark: CompletedWatermark,
  },
}

export function StatCard({
  title,
  value,
  icon,
  trend,
  color = 'primary',
  watermark = false,
  variant,
}) {
  const theme = variant && VARIANT_THEME[variant]
  const accent = theme?.color || (color in ICON_BOX ? color : 'primary')
  const BadgeIcon = theme?.badge
  const WatermarkArt = theme?.watermark
  const iconClass = 'h-4 w-4 xl:h-[18px] xl:w-[18px]'

  return (
    <div className="group relative flex h-full min-h-[8.75rem] flex-col overflow-hidden rounded-2xl border border-border bg-card p-3.5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md sm:p-4 xl:min-h-0 xl:p-6">
      {watermark && WatermarkArt && (
        <div
          className={`pointer-events-none absolute opacity-[0.1] transition-opacity duration-300 group-hover:opacity-[0.16] ${WATERMARK_COLOR[accent]} right-1 bottom-1 h-12 w-12 xl:-right-1 xl:top-0 xl:bottom-0 xl:flex xl:h-auto xl:w-[44%] xl:max-w-[10rem] xl:items-center xl:justify-end xl:pr-3 xl:opacity-[0.12] xl:group-hover:opacity-[0.18]`}
          aria-hidden="true"
        >
          <WatermarkArt />
        </div>
      )}

      <div className={`relative z-10 flex min-h-0 flex-1 flex-col ${watermark ? 'xl:pr-[36%]' : ''}`}>
        {watermark ? (
          <>
            <div className="flex min-w-0 items-start gap-2 xl:items-center xl:gap-2.5">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm xl:h-9 xl:w-9 ${ICON_BOX[accent]}`}
              >
                {BadgeIcon ? <BadgeIcon className={iconClass} /> : icon}
              </div>
              <p className={`min-w-0 text-[13px] font-semibold leading-snug sm:text-sm xl:truncate xl:text-[15px] ${TITLE_COLOR[accent]}`}>
                {title}
              </p>
            </div>
            <p className="mt-auto pt-3 text-[1.75rem] font-bold tracking-tight text-foreground sm:text-3xl xl:mt-3 xl:pt-0 xl:text-4xl">
              {value}
            </p>
            {trend && <p className="mt-0.5 text-[11px] leading-snug text-muted sm:text-xs xl:mt-1 xl:text-sm">{trend}</p>}
          </>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted">{title}</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
              {trend && <p className="mt-1 text-xs text-muted">{trend}</p>}
            </div>
            {icon && (
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${GRADIENT[accent]} text-white shadow-lg transition-transform duration-300 group-hover:scale-110`}
              >
                {icon}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
