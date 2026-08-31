import { PATIENT_STATUS, PATIENT_STATUS_LABELS } from '@/utils/constants'

export const STATUS_BADGE_STYLES = {
  [PATIENT_STATUS.WAITING]: {
    backgroundColor: '#FEF3C7',
    color: '#B45309',
  },
  [PATIENT_STATUS.IN_CONSULTATION]: {
    backgroundColor: '#DBEAFE',
    color: '#1D4ED8',
  },
  [PATIENT_STATUS.COMPLETED]: {
    backgroundColor: '#DCFCE7',
    color: '#15803D',
  },
  [PATIENT_STATUS.CANCELLED]: {
    backgroundColor: '#FEE2E2',
    color: '#B91C1C',
  },
}

const DEFAULT_STYLE = {
  backgroundColor: '#F3F4F6',
  color: '#374151',
}

export function StatusBadge({ status, label, className = '' }) {
  const styles = STATUS_BADGE_STYLES[status] || DEFAULT_STYLE
  const text = label ?? PATIENT_STATUS_LABELS[status] ?? status

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}
      style={{ backgroundColor: styles.backgroundColor, color: styles.color }}
    >
      {text}
    </span>
  )
}
