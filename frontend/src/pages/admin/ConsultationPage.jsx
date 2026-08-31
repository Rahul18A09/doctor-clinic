import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { doctorConsultationService } from '@/api/doctor'
import { PatientStatusBadge } from '@/components/patients/PatientStatusBadge'
import { BackButton, Button, CompleteTreatmentDialog, ConfirmDialog, Input } from '@/components/ui'
import { useToast } from '@/context/ToastContext'
import { useNotifications } from '@/hooks/useNotifications'
import { CONSULTATION_TABS, PATIENT_STATUS, ROUTES } from '@/utils/constants'
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

function DetailRow({ label, value }) {
  return (
    <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm text-foreground sm:col-span-2 sm:mt-0">{value || '—'}</dd>
    </div>
  )
}

function SectionCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-4 sm:px-6">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      </div>
      <div className="px-4 py-4 sm:px-6">{children}</div>
    </div>
  )
}

function consultationsPath(tab) {
  return `${ROUTES.ADMIN_CONSULTATIONS}?tab=${tab}`
}

export function ConsultationPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showSuccess, showError } = useToast()
  const { refresh: refreshNotifications } = useNotifications()

  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [starting, setStarting] = useState(false)
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

  const isReadOnly = patient?.status === PATIENT_STATUS.COMPLETED
  const isWaiting = patient?.status === PATIENT_STATUS.WAITING
  const isInConsultation = patient?.status === PATIENT_STATUS.IN_CONSULTATION

  const backTab = isReadOnly
    ? CONSULTATION_TABS.COMPLETED
    : isInConsultation
      ? CONSULTATION_TABS.IN_CONSULTATION
      : CONSULTATION_TABS.WAITING

  const {
    register,
    reset,
    getValues,
    formState: { errors },
  } = useForm({
    defaultValues: {
      temperature: '',
      blood_pressure: '',
      pulse: '',
      weight: '',
      height: '',
      diagnosis: '',
      doctor_notes: '',
      prescription: '',
    },
  })

  const loadPatient = async () => {
    try {
      const { data: res } = await doctorConsultationService.get(id)
      const p = res.data.patient
      setPatient(p)
      reset({
        temperature: p.temperature != null ? String(p.temperature) : '',
        blood_pressure: p.blood_pressure || '',
        pulse: p.pulse || '',
        weight: p.weight != null ? String(p.weight) : '',
        height: p.height != null ? String(p.height) : '',
        diagnosis: p.diagnosis || '',
        doctor_notes: p.doctor_notes || '',
        prescription: p.prescription || '',
      })
    } catch (err) {
      showError(err.response?.data?.message || err.message)
      navigate(consultationsPath(CONSULTATION_TABS.WAITING))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPatient()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const buildPayload = (formData) => {
    const payload = {
      blood_pressure: formData.blood_pressure.trim(),
      pulse: formData.pulse.trim(),
      diagnosis: formData.diagnosis.trim(),
      doctor_notes: formData.doctor_notes.trim(),
      prescription: formData.prescription.trim(),
    }
    if (formData.temperature !== '') {
      payload.temperature = parseFloat(formData.temperature)
    }
    if (formData.weight !== '') {
      payload.weight = parseFloat(formData.weight)
    }
    if (formData.height !== '') {
      payload.height = parseFloat(formData.height)
    }
    return payload
  }

  const handleComplete = async () => {
    setCompleting(true)
    try {
      // Persist notes/vitals when already in consultation; waiting patients can
      // complete directly without a separate start/save-draft step.
      if (patient?.status === PATIENT_STATUS.IN_CONSULTATION) {
        await doctorConsultationService.saveConsultation(id, buildPayload(getValues()))
      }
      await doctorConsultationService.complete(id)
      await refreshNotifications()
      setCompleteDialogOpen(false)
      showSuccess('Treatment completed successfully.')
      navigate(consultationsPath(CONSULTATION_TABS.COMPLETED))
    } catch (err) {
      showError(err.response?.data?.message || err.message)
    } finally {
      setCompleting(false)
    }
  }

  const handleCancel = async () => {
    setCancelling(true)
    try {
      await doctorConsultationService.cancel(id)
      showSuccess('Consultation cancelled. Patient returned to waiting queue.')
      navigate(consultationsPath(CONSULTATION_TABS.WAITING))
    } catch (err) {
      showError(err.response?.data?.message || err.message)
    } finally {
      setCancelling(false)
      setCancelDialogOpen(false)
    }
  }

  const handleStartConsultation = async () => {
    setStarting(true)
    try {
      const { data: res } = await doctorConsultationService.start(id)
      await refreshNotifications()
      setPatient(res.data.patient)
      showSuccess('Consultation started successfully.')
    } catch (err) {
      showError(err.response?.data?.message || err.message)
    } finally {
      setStarting(false)
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
    <div className="space-y-6 animate-in">
      <BackButton to={consultationsPath(backTab)}>Back to Consultations</BackButton>
      <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold text-foreground sm:text-2xl">Consultation</h2>
            <PatientStatusBadge status={patient.status} />
          </div>
          <p className="mt-1 font-mono text-sm text-primary-600">
            {formatTokenForUi(patient.token_number)} · Visit #{patient.visit_number || 1}
          </p>
        </div>
        {isWaiting && (
          <div className="flex flex-wrap gap-3">
            <Button disabled={starting} onClick={handleStartConsultation} className="w-full sm:w-auto">
              {starting ? 'Starting...' : 'Start Consultation'}
            </Button>
            <Button
              variant="secondary"
              disabled={completing}
              onClick={() => setCompleteDialogOpen(true)}
              className="w-full sm:w-auto"
            >
              Complete Treatment
            </Button>
          </div>
        )}
      </div>

      <SectionCard title="Patient Information">
        <dl className="divide-y divide-border">
          <DetailRow label="Token" value={formatTokenForUi(patient.token_number)} />
          <DetailRow label="Visit Number" value={`#${patient.visit_number || 1}`} />
          <DetailRow label="Patient Name" value={patient.patient_name} />
          <DetailRow label="Age" value={patient.age} />
          <DetailRow label="Gender" value={patient.gender} />
          <DetailRow label="Blood Group" value={patient.blood_group} />
          <DetailRow label="Mobile" value={patient.mobile} />
          <DetailRow label="Address" value={patient.address} />
          <DetailRow label="Chief Complaint" value={patient.chief_complaint} />
          <DetailRow label="Registered By" value={patient.created_by_name} />
          <DetailRow label="Registered Time" value={formatDate(patient.created_at)} />
        </dl>
      </SectionCard>

      {isReadOnly && (
        <>
          <SectionCard title="Vitals">
            <dl className="divide-y divide-border">
              <DetailRow label="Temperature" value={patient.temperature ? `${patient.temperature} °F` : null} />
              <DetailRow label="Blood Pressure" value={patient.blood_pressure} />
              <DetailRow label="Pulse" value={patient.pulse} />
              <DetailRow label="Weight" value={patient.weight ? `${patient.weight} kg` : null} />
              <DetailRow label="Height" value={patient.height ? `${patient.height} cm` : null} />
            </dl>
          </SectionCard>
          <SectionCard title="Diagnosis">
            <p className="whitespace-pre-wrap text-sm text-foreground">{patient.diagnosis || '—'}</p>
          </SectionCard>
          <SectionCard title="Doctor Notes">
            <p className="whitespace-pre-wrap text-sm text-foreground">{patient.doctor_notes || '—'}</p>
          </SectionCard>
          <SectionCard title="Prescription">
            <p className="whitespace-pre-wrap text-sm text-foreground">{patient.prescription || '—'}</p>
          </SectionCard>
        </>
      )}

      {isInConsultation && (
        <div className="space-y-6">
          <SectionCard title="Vitals">
            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                id="temperature"
                label="Temperature (°F)"
                type="number"
                step="0.1"
                placeholder="e.g. 98.6"
                error={errors.temperature}
                {...register('temperature')}
              />
              <Input
                id="blood_pressure"
                label="Blood Pressure"
                placeholder="e.g. 120/80"
                error={errors.blood_pressure}
                {...register('blood_pressure')}
              />
              <Input
                id="pulse"
                label="Pulse"
                placeholder="e.g. 72"
                error={errors.pulse}
                {...register('pulse')}
              />
              <Input
                id="weight"
                label="Weight (kg)"
                type="number"
                step="0.1"
                placeholder="e.g. 70"
                error={errors.weight}
                {...register('weight')}
              />
              <Input
                id="height"
                label="Height (cm)"
                type="number"
                step="0.1"
                placeholder="e.g. 170"
                error={errors.height}
                {...register('height')}
              />
            </div>
          </SectionCard>

          <SectionCard title="Diagnosis">
            <textarea
              id="diagnosis"
              rows={4}
              placeholder="Enter diagnosis..."
              className="block w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground shadow-sm placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              {...register('diagnosis')}
            />
          </SectionCard>

          <SectionCard title="Doctor Notes">
            <textarea
              id="doctor_notes"
              rows={4}
              placeholder="Enter doctor notes..."
              className="block w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground shadow-sm placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              {...register('doctor_notes')}
            />
          </SectionCard>

          <SectionCard title="Prescription">
            <textarea
              id="prescription"
              rows={8}
              placeholder="Enter prescription details..."
              className="block w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground shadow-sm placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              {...register('prescription')}
            />
          </SectionCard>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              disabled={completing}
              onClick={() => setCompleteDialogOpen(true)}
              className="w-full sm:w-auto"
            >
              Complete Treatment
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-red-600 hover:text-red-700 sm:w-auto"
              disabled={cancelling}
              onClick={() => setCancelDialogOpen(true)}
            >
              Cancel Consultation
            </Button>
            <Link to={consultationsPath(CONSULTATION_TABS.IN_CONSULTATION)} className="w-full sm:w-auto">
              <Button type="button" variant="ghost" className="w-full sm:w-auto">
                Back
              </Button>
            </Link>
          </div>
        </div>
      )}

      {isWaiting && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 sm:px-6">
          You can complete treatment directly, or start the consultation to record vitals,
          diagnosis, and prescription first.
          {patient.diagnosis || patient.prescription ? (
            <span className="mt-1 block">
              Previous notes from a cancelled consultation are preserved and will be restored
              when you start again.
            </span>
          ) : null}
        </div>
      )}

      {isReadOnly && (
        <div className="flex flex-wrap gap-3">
          <BackButton to={consultationsPath(CONSULTATION_TABS.COMPLETED)}>Back to Completed</BackButton>
        </div>
      )}

      <CompleteTreatmentDialog
        open={completeDialogOpen}
        patientName={patient.patient_name}
        tokenNumber={formatTokenForUi(patient.token_number)}
        loading={completing}
        onConfirm={handleComplete}
        onCancel={() => {
          if (!completing) setCompleteDialogOpen(false)
        }}
      />

      <ConfirmDialog
        open={cancelDialogOpen}
        title="Cancel Consultation"
        message={`Cancel consultation for "${patient.patient_name}"? The patient will return to the waiting queue. Draft data will be preserved.`}
        confirmLabel="Cancel Consultation"
        loading={cancelling}
        onConfirm={handleCancel}
        onCancel={() => setCancelDialogOpen(false)}
      />
      </div>
    </div>
  )
}
