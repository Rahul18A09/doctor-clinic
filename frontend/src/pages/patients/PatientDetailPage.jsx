import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { patientService } from '@/api/patients'
import { PatientStatusBadge } from '@/components/patients/PatientStatusBadge'
import { BackButton, Button } from '@/components/ui'
import { useToast } from '@/context/ToastContext'
import { ROUTES } from '@/utils/constants'
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

export function PatientDetailPage({ basePath, canEdit = false, isAdmin = false }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showError } = useToast()
  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(true)

  const listPath = isAdmin ? ROUTES.ADMIN_PATIENTS : ROUTES.RECEPTION_PATIENTS

  const showEditButton =
    canEdit &&
    patient &&
    (isAdmin
      ? patient.is_editable_by_admin !== false
      : patient.is_editable_by_receptionist !== false)

  useEffect(() => {
    if (!id) return undefined
    const controller = new AbortController()
    let cancelled = false
    setLoading(true)
    setPatient(null)

    async function load() {
      try {
        const { data: res } = await patientService.get(id, { signal: controller.signal })
        if (cancelled) return
        setPatient(res.data.patient)
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
  }, [id, listPath, navigate, showError])

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

      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-4 sm:px-6">
            <h3 className="text-lg font-semibold text-foreground">Registration Details</h3>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h2 className="min-w-0 break-words text-xl font-bold text-foreground sm:text-2xl">
                {patient.patient_name}
              </h2>
              <PatientStatusBadge status={patient.status} />
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
            <DetailRow label="Registered By" value={patient.created_by_name} />
            <DetailRow label="Registered At" value={formatDate(patient.created_at)} />
            <DetailRow label="Last Updated" value={formatDate(patient.updated_at)} />
          </dl>
        </div>
      </div>
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
