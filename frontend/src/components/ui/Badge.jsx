const BADGE_VARIANTS = {
  default: {
    backgroundColor: '#F3F4F6',
    color: '#374151',
  },
  success: {
    backgroundColor: '#DCFCE7',
    color: '#15803D',
  },
  danger: {
    backgroundColor: '#FEE2E2',
    color: '#B91C1C',
  },
  warning: {
    backgroundColor: '#FEF3C7',
    color: '#B45309',
  },
  info: {
    backgroundColor: '#DBEAFE',
    color: '#1D4ED8',
  },
}

export function Badge({ children, variant = 'default' }) {
  const styles = BADGE_VARIANTS[variant] || BADGE_VARIANTS.default

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: styles.backgroundColor, color: styles.color }}
    >
      {children}
    </span>
  )
}
