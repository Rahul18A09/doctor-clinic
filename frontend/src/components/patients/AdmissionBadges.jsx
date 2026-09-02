import { Badge } from '@/components/ui/Badge'
import { ADMISSION_STATUS, CARE_TYPE } from '@/utils/constants'

export function CareTypeBadge({ careType }) {
  if (!careType) return null
  return (
    <Badge variant={careType === CARE_TYPE.INPATIENT ? 'info' : 'default'}>{careType}</Badge>
  )
}

export function AdmissionStatusBadge({ status }) {
  if (!status) return null
  const variant =
    status === ADMISSION_STATUS.ADMITTED
      ? 'success'
      : status === ADMISSION_STATUS.REQUIRED
        ? 'warning'
        : 'default'
  return <Badge variant={variant}>{status}</Badge>
}
