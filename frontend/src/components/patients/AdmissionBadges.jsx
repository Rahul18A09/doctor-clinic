import { Badge } from '@/components/ui/Badge'
import { ADMISSION_STATUS, CARE_TYPE, admissionStatusLabel, isAdmissionPending } from '@/utils/constants'

export function CareTypeBadge({ careType }) {
  if (!careType) return null
  return (
    <Badge variant={careType === CARE_TYPE.INPATIENT ? 'info' : 'default'}>{careType}</Badge>
  )
}

export function AdmissionStatusBadge({ status }) {
  if (!status) return null
  const label = admissionStatusLabel(status)
  const variant =
    status === ADMISSION_STATUS.ADMITTED
      ? 'success'
      : isAdmissionPending(status)
        ? 'warning'
        : status === ADMISSION_STATUS.DISCHARGED
          ? 'default'
          : 'default'
  return <Badge variant={variant}>{label}</Badge>
}
