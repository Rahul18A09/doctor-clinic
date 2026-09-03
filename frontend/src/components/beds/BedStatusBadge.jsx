import { BED_STATUS, BED_STATUS_LABELS } from '@/utils/constants'

const STYLES = {
  [BED_STATUS.AVAILABLE]: { backgroundColor: '#DCFCE7', color: '#15803D' },
  [BED_STATUS.OCCUPIED]: { backgroundColor: '#DBEAFE', color: '#1D4ED8' },
  [BED_STATUS.RESERVED]: { backgroundColor: '#FEF3C7', color: '#B45309' },
  [BED_STATUS.MAINTENANCE]: { backgroundColor: '#FEE2E2', color: '#B91C1C' },
  [BED_STATUS.BLOCKED]: { backgroundColor: '#FEE2E2', color: '#B91C1C' },
}

const DEFAULT_STYLE = { backgroundColor: '#F3F4F6', color: '#374151' }

export function BedStatusBadge({ status, className = '' }) {
  const styles = STYLES[status] || DEFAULT_STYLE
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${className}`}
      style={{ backgroundColor: styles.backgroundColor, color: styles.color }}
    >
      {BED_STATUS_LABELS[status] || status}
    </span>
  )
}
