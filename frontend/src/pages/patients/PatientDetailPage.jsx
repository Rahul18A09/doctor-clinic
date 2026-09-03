import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { bedService, getBedsErrorMessage, roomService } from '@/api/beds'
import { patientService } from '@/api/patients'
import { AssignPatientToBedModal } from '@/components/beds/AssignPatientToBedModal'
import { BedStatusBadge } from '@/components/beds/BedStatusBadge'
import { canReleaseBed, formatAssignedAt } from '@/components/beds/bedUtils'
import { AdmissionStatusBadge, CareTypeBadge } from '@/components/patients/AdmissionBadges'
import { PatientStatusBadge } from '@/components/patients/PatientStatusBadge'
import { BackButton, Button, ConfirmDialog } from '@/components/ui'
import { useToast } from '@/context/ToastContext'
import { useNotifications } from '@/hooks/useNotifications'
import { ADMISSION_STATUS, CARE_TYPE, isAdmissionPending, ROUTES } from '@/utils/constants'
import { formatTokenForUi } from '@/utils/formatToken'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isRequestCanceled(err) {
  return err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError' || err?.name === 'AbortError'
}

function DetailRow({ label, value }) {
  return (
    <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm text-foreground sm:col-span-2 sm:mt-0">{value || '—'}</dd>
    </div>
  )
}

async function loadActiveAssignment(patientId, signal) {
  const { data: res } = await bedService.list(
    { patient_id: patientId, page: 1, page_size: 10 },
    { signal },
  )
  const rows = res.data?.results || []
  const bed =
    rows.find((row) => row.status === 'occupied' || row.status === 'reserved') || rows[0] || null
  if (!bed) return null
  let room = null
  try {
    const { data: roomRes } = await roomService.get(bed.room_id, { signal })
    room = roomRes.data?.room || null
  } catch (err) {
    if (isRequestCanceled(err)) throw err
  }
  return { bed, room }
}

export function PatientDetailPage({ basePath, canEdit = false, isAdmin = false }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showError, showSuccess } = useToast()
  const { refresh: refreshNotifications } = useNotifications()
  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [assignment, setAssignment] = useState(null)
  const [assignmentLoading, setAssignmentLoading] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [dischargeOpen, setDischargeOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const listPath = isAdmin ? ROUTES.ADMIN_PATIENTS : ROUTES.RECEPTION_PATIENTS

  const showEditButton =
    canEdit &&
    patient &&
    (isAdmin
      ? patient.is_editable_by_admin !== false
      : patient.is_editable_by_receptionist !== false)

  const canAssign =
    Boolean(patient) &&
    isAdmissionPending(patient.admission_status) &&
    !assignment
  const canDischarge =
    Boolean(patient) &&
    patient.care_type === CARE_TYPE.INPATIENT &&
    (patient.admission_status === ADMISSION_STATUS.ADMITTED || canReleaseBed(assignment?.bed))

  const refreshAssignment = useCallback(
    async (signal) => {
      if (!id) return
      setAssignmentLoading(true)
      try {
        const next = await loadActiveAssignment(id, signal)
        if (signal?.aborted) return
        setAssignment(next)
      } catch (err) {
        if (isRequestCanceled(err)) return
        setAssignment(null)
      } finally {
        if (!signal?.aborted) setAssignmentLoading(false)
      }
    },
    [id],
  )

  useEffect(() => {
    if (!id) return undefined
    const controller = new AbortController()
    let cancelled = false
    setLoading(true)
    setPatient(null)
    setAssignment(null)

    async function load() {
      try {
        const { data: res } = await patientService.get(id, { signal: controller.signal })
        if (cancelled) return
        setPatient(res.data.patient)
        await refreshAssignment(controller.signal)
      } catch (err) {
        if (cancelled || isRequestCanceled(err)) return
        const missing = err.response?.status === 404
        showError(missing ? 'This visit is no longer available.' : err.response?.data?.message || err.message)
        navigate(listPath, { replace: true })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [id, listPath, navigate, refreshAssignment, showError])

  const handleAssign = async (bedId) => {
    if (!id) return
    setSubmitting(true)
    try {
      await bedService.assign(bedId, { patient_id: id })
      showSuccess('Bed assigned successfully.')
      setAssignOpen(false)
      const { data: res } = await patientService.get(id)
      setPatient(res.data.patient)
      await refreshAssignment()
      void refreshNotifications()
    } catch (error) {
      showError(getBedsErrorMessage(error, 'Could not assign patient to this bed.'))
      throw error
    } finally {
      setSubmitting(false)
    }
  }

  const handleDischarge = async () => {
    if (!id) return
    setSubmitting(true)
    try {
      const { data: res } = await patientService.discharge(id)
      showSuccess('Patient discharged successfully.')
      setDischargeOpen(false)
      setPatient(res.data.patient)
      await refreshAssignment()
      void refreshNotifications()
    } catch (error) {
      showError(getBedsErrorMessage(error, 'Could not discharge this patient.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  if (!patient) return null

  return (
    <div className="animate-in">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <BackButton to={listPath}>Back to Patients</BackButton>
        {showEditButton && (
          <Button onClick={() => navigate(`${basePath}/${id}/edit`)} className="w-full sm:w-auto">
            Edit Patient
          </Button>
        )}
      </div>

      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-4 sm:px-6">
            <h3 className="text-lg font-semibold text-foreground">Registration Details</h3>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h2 className="min-w-0 break-words text-xl font-bold text-foreground sm:text-2xl">
                {patient.patient_name}
              </h2>
              <PatientStatusBadge status={patient.status} />
              <CareTypeBadge careType={patient.care_type} />
              <AdmissionStatusBadge status={patient.admission_status} />
            </div>
            <p className="mt-1 font-mono text-sm text-primary-600">
              {formatTokenForUi(patient.token_number)} · Visit #{patient.visit_number || 1}
            </p>
          </div>
          <dl className="divide-y divide-border px-4 sm:px-6">
            <DetailRow label="Token" value={formatTokenForUi(patient.token_number)} />
            <DetailRow label="Visit Number" value={`#${patient.visit_number || 1}`} />
            <DetailRow label="Patient Name" value={patient.patient_name} />
            <DetailRow label="Mobile" value={patient.mobile} />
            <DetailRow label="Age" value={patient.age} />
            <DetailRow label="Gender" value={patient.gender} />
            <DetailRow label="Blood Group" value={patient.blood_group} />
            <DetailRow label="Address" value={patient.address} />
            <DetailRow label="Chief Complaint" value={patient.chief_complaint} />
            <DetailRow label="Patient Type" value={patient.care_type || '—'} />
            <DetailRow
              label="Admission Status"
              value={
                patient.admission_status ? (
                  <AdmissionStatusBadge status={patient.admission_status} />
                ) : (
                  '—'
                )
              }
            />
            <DetailRow
              label="Visit Status"
              value={<PatientStatusBadge status={patient.status} />}
            />
            <DetailRow label="Registered By" value={patient.created_by_name} />
            <DetailRow label="Registered At" value={formatDate(patient.created_at)} />
            <DetailRow label="Last Updated" value={formatDate(patient.updated_at)} />
          </dl>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <h3 className="text-lg font-semibold text-foreground">Bed assignment</h3>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              {canAssign && (
                <Button className="w-full sm:w-auto" onClick={() => setAssignOpen(true)}>
                  Assign Bed
                </Button>
              )}
              {canDischarge && (
                <Button
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => setDischargeOpen(true)}
                >
                  Discharge
                </Button>
              )}
            </div>
          </div>
          <div className="px-4 py-4 sm:px-6">
            {assignmentLoading ? (
              <p className="text-sm text-muted">Loading bed assignment...</p>
            ) : assignment?.bed ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <dl className="min-w-0 flex-1 divide-y divide-border">
                  <DetailRow
                    label="Room"
                    value={assignment.room?.room_number ? `Room ${assignment.room.room_number}` : '—'}
                  />
                  <DetailRow label="Bed" value={assignment.bed.bed_number} />
                  <DetailRow
                    label="Status"
                    value={<BedStatusBadge status={assignment.bed.status} />}
                  />
                  <DetailRow label="Assigned At" value={formatAssignedAt(assignment.bed.assigned_at)} />
                </dl>
              </div>
            ) : (
              <p className="text-sm text-muted">
                {isAdmissionPending(patient.admission_status)
                  ? 'Admission pending. Assign an available bed to admit this patient.'
                  : patient.admission_status === ADMISSION_STATUS.DISCHARGED
                    ? 'This visit has been discharged. No active bed.'
                    : patient.care_type === CARE_TYPE.OUTPATIENT
                      ? 'Outpatient visits do not require a bed.'
                      : 'No bed assigned to this visit.'}
              </p>
            )}
          </div>
        </div>
      </div>

      <AssignPatientToBedModal
        open={assignOpen}
        patient={patient}
        submitting={submitting}
        onClose={() => setAssignOpen(false)}
        onAssign={handleAssign}
      />
      <ConfirmDialog
        open={dischargeOpen}
        title="Discharge patient"
        message="Discharge this patient, end the admission, and release the assigned bed?"
        confirmLabel="Discharge"
        variant="danger"
        loading={submitting}
        onConfirm={handleDischarge}
        onCancel={() => {
          if (!submitting) setDischargeOpen(false)
        }}
      />
    </div>
  )
}

export function AdminPatientDetailPage() {
  return (
    <PatientDetailPage basePath={ROUTES.ADMIN_PATIENTS} canEdit isAdmin />
  )
}

export function ReceptionPatientDetailPage() {
  return (
    <PatientDetailPage basePath={ROUTES.RECEPTION_PATIENTS} canEdit />
  )
}
