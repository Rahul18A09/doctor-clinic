import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { patientService } from '@/api/patients'
import { PatientStatusBadge } from '@/components/patients/PatientStatusBadge'
import { BackButton, Button, Input, Select } from '@/components/ui'
import { useToast } from '@/context/ToastContext'
import { useNotifications } from '@/hooks/useNotifications'
import { BLOOD_GROUPS, GENDERS, ROUTES } from '@/utils/constants'
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

function isMobileQuery(value) {
  return /^[0-9]{10}$/.test(String(value ?? '').trim())
}

function applyLookupResult(data, setLookup, setStep) {
  setLookup(data)
  if (!data?.found) {
    setStep('search')
    return
  }
  if (data.multiple) {
    setStep('matches')
    return
  }
  setStep('found')
}

const EMPTY_FORM = {
  patient_name: '',
  mobile: '',
  age: '',
  gender: '',
  blood_group: '',
  address: '',
  chief_complaint: '',
}

export function PatientFormPage({
  listPath = ROUTES.RECEPTION_PATIENTS,
  isAdmin = false,
}) {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { showSuccess, showError } = useToast()
  const { refresh: refreshNotifications } = useNotifications()
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [selectingId, setSelectingId] = useState(null)
  const [lookup, setLookup] = useState(null)
  const [step, setStep] = useState(isEdit ? 'form' : 'search')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: EMPTY_FORM,
  })

  useEffect(() => {
    if (!isEdit) return

    async function loadPatient() {
      try {
        const { data: res } = await patientService.get(id)
        const p = res.data.patient

        if (!isAdmin && p.is_editable_by_receptionist === false) {
          showError('Patient registration cannot be edited after consultation has started.')
          navigate(listPath)
          return
        }

        reset({
          patient_name: p.patient_name,
          mobile: p.mobile,
          age: String(p.age),
          gender: p.gender,
          blood_group: p.blood_group,
          address: p.address,
          chief_complaint: p.chief_complaint,
        })
      } catch (err) {
        showError(err.response?.data?.message || err.message)
        navigate(listPath)
      } finally {
        setLoading(false)
      }
    }

    loadPatient()
  }, [id, isEdit, isAdmin, reset, navigate, listPath, showError])

  const openCreateForm = (prefillMobile = '', prefillName = '') => {
    reset({
      ...EMPTY_FORM,
      mobile: prefillMobile,
      patient_name: prefillName,
    })
    setLookup(null)
    setStep('form')
  }

  const openReturningForm = (data) => {
    reset({
      patient_name: data.patient.patient_name,
      mobile: data.mobile,
      age: String(data.patient.age),
      gender: data.patient.gender,
      blood_group: data.patient.blood_group || '',
      address: data.patient.address || '',
      chief_complaint: '',
    })
    setStep('form')
  }

  const handleSearch = async (event) => {
    event.preventDefault()
    const query = searchQuery.trim()
    if (!query) {
      showError('Enter a mobile number or full name.')
      return
    }

    setSearching(true)
    try {
      const { data: res } = await patientService.lookup({ q: query })
      if (!res.data?.found) {
        setLookup(res.data)
        setStep('search')
        showError('No existing patient found for this search. Please register a new patient.')
        return
      }
      applyLookupResult(res.data, setLookup, setStep)
    } catch (err) {
      showError(err.response?.data?.message || err.message)
      setLookup(null)
      setStep('search')
    } finally {
      setSearching(false)
    }
  }

  const handleSelectMatch = async (patientId) => {
    if (!patientId || selectingId) return
    setSelectingId(patientId)
    try {
      const { data: res } = await patientService.lookup({ patient_id: patientId })
      applyLookupResult(res.data, setLookup, setStep)
    } catch (err) {
      showError(err.response?.data?.message || err.message)
    } finally {
      setSelectingId(null)
    }
  }

  const onSubmit = async (formData) => {
    setSubmitting(true)
    try {
      const payload = {
        patient_name: formData.patient_name.trim(),
        mobile: formData.mobile.trim(),
        age: parseInt(formData.age, 10),
        gender: formData.gender,
        blood_group: formData.blood_group || '',
        address: formData.address.trim(),
        chief_complaint: formData.chief_complaint.trim(),
      }

      if (isEdit) {
        await patientService.update(id, payload)
        showSuccess('Patient updated successfully.')
        navigate(`${listPath}/${id}`)
      } else {
        if (lookup?.found && lookup.patient_id && !lookup.multiple) {
          payload.patient_id = lookup.patient_id
        }
        const { data: res } = await patientService.create(payload)
        await refreshNotifications()
        const token = formatTokenForUi(res.data.patient.token_number)
        const visitNumber = res.data.patient.visit_number
        if (lookup?.found && lookup.patient_id && !lookup.multiple) {
          showSuccess(
            `New visit registered with token ${token}${
              visitNumber ? ` · Visit #${visitNumber}` : ''
            }.`
          )
        } else {
          showSuccess(
            `New patient created successfully with token ${token}${
              visitNumber ? ` · Visit #${visitNumber}` : ''
            }.`
          )
        }
        navigate(listPath)
      }
    } catch (err) {
      const apiErrors = err.response?.data?.errors
      if (apiErrors) {
        showError(Object.values(apiErrors).flat()[0] || err.response?.data?.message)
      } else {
        showError(err.response?.data?.message || err.message)
      }
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

  const isReturningVisit = !isEdit && lookup?.found && !lookup.multiple && step === 'form'
  const visits = lookup?.visits || []

  return (
    <div className="animate-in">
      <div className="mb-6">
        <BackButton to={listPath}>Back to Patients</BackButton>
      </div>
      <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
          {isEdit
            ? 'Edit Patient'
            : isReturningVisit
              ? 'Register New Visit'
              : step === 'search'
                ? 'Patient Registration'
                : 'Register Patient'}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {isEdit
            ? 'Update patient registration details.'
            : step === 'search'
              ? 'Find an existing patient or register a new patient.'
              : 'Search by mobile number or full name, or create a new patient.'}
        </p>
      </div>

      {!isEdit && step === 'search' && (
        <div className="space-y-5">
          <form
            onSubmit={handleSearch}
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
          >
            <div className="bg-primary-50/80 px-4 py-4 sm:px-8 sm:py-5">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
                    />
                  </svg>
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-foreground sm:text-lg">Find Existing Patient</h3>
                  <p className="mt-0.5 text-sm text-muted">
                    Search by mobile number or full name to find an existing patient.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5 p-4 sm:p-8">
              <div className="space-y-1">
                <label htmlFor="patient_search" className="block text-sm font-semibold text-foreground">
                  Mobile Number or Full Name
                </label>
                <div className="relative">
                  <input
                    id="patient_search"
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Enter 10-digit mobile number or full name"
                    className="block w-full rounded-xl border border-border bg-card py-2.5 pl-3 pr-11 text-sm text-foreground shadow-sm placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </span>
                </div>
                <p className="text-xs text-muted">
                  Enter mobile number or full name to search. If multiple patients match, you will choose
                  from a list.
                </p>
              </div>

              <Button type="submit" disabled={searching} className="w-full sm:w-auto">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
                  />
                </svg>
                {searching ? 'Searching...' : 'Search Patient'}
              </Button>
            </div>

            <div className="relative px-4 sm:px-8">
              <div className="border-t border-border" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-card px-3 py-0.5 text-xs font-semibold tracking-wide text-muted">
                OR
              </span>
            </div>

            <div className="p-4 sm:p-8">
              <div className="rounded-2xl bg-emerald-50 px-4 py-4 sm:px-5 sm:py-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                      />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-foreground">New Patient?</h3>
                    <p className="mt-0.5 text-sm text-muted">
                      If the patient is not in the system, register a new patient.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    openCreateForm(
                      isMobileQuery(searchQuery) ? searchQuery.trim() : '',
                      searchQuery.trim() && !isMobileQuery(searchQuery) ? searchQuery.trim() : '',
                    )
                  }
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 sm:w-auto"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Register New Patient
                </button>
              </div>
            </div>

            <div className="flex justify-center border-t border-border px-4 py-4 sm:px-8">
              <Link to={listPath}>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </div>
      )}

      {!isEdit && step === 'matches' && lookup?.multiple && (
        <div className="space-y-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-8">
          <div className="rounded-xl border border-border bg-surface px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Multiple patients found</p>
            <p className="mt-1 text-sm text-muted">
              {lookup.match_count} patients match this name. Select one to register a new visit.
              A patient is not chosen automatically.
            </p>
          </div>
          <div className="space-y-3 lg:hidden">
            {(lookup.matches || []).map((match) => (
              <div key={match.patient_id} className="rounded-xl border border-border bg-card p-4">
                <p className="font-semibold text-foreground">{match.patient_name}</p>
                <p className="mt-1 font-mono text-sm text-muted">{match.mobile_masked}</p>
                <p className="mt-1 text-sm text-muted">Last visit: {formatDate(match.last_visit)}</p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-3 w-full"
                  disabled={Boolean(selectingId)}
                  onClick={() => handleSelectMatch(match.patient_id)}
                >
                  {selectingId === match.patient_id ? 'Opening...' : 'Select'}
                </Button>
              </div>
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-xl border border-border lg:block">
            <div className="table-scroll">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="border-b border-border bg-surface">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-2.5 font-medium text-muted">Name</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-medium text-muted">Mobile</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-medium text-muted">Last Visit</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-medium text-muted"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(lookup.matches || []).map((match) => (
                    <tr key={match.patient_id}>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                        {match.patient_name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-muted">
                        {match.mobile_masked}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">
                        {formatDate(match.last_visit)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Button
                          type="button"
                          size="sm"
                          disabled={Boolean(selectingId)}
                          onClick={() => handleSelectMatch(match.patient_id)}
                        >
                          {selectingId === match.patient_id ? 'Opening...' : 'Select'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={() => setStep('search')}>
              Search again
            </Button>
          </div>
        </div>
      )}

      {!isEdit && step === 'found' && lookup?.found && !lookup.multiple && (
        <div className="space-y-5 rounded-2xl border border-primary-100 bg-card p-4 shadow-sm sm:p-8">
          <div className="rounded-xl border border-primary-100 bg-primary-50 px-4 py-3">
            <p className="text-sm font-semibold text-primary-800">Existing Patient Found</p>
            <p className="mt-1 text-sm text-primary-700">
              Next visit #{lookup.next_visit_number} ({lookup.visit_count} previous
              visit{lookup.visit_count === 1 ? '' : 's'}).
            </p>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted">Mobile</dt>
              <dd className="mt-1 text-sm text-foreground">{lookup.mobile}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Name</dt>
              <dd className="mt-1 text-sm text-foreground">{lookup.patient.patient_name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Age / Gender</dt>
              <dd className="mt-1 text-sm text-foreground">
                {lookup.patient.age} / {lookup.patient.gender}
              </dd>
            </div>
            {lookup.patient.blood_group ? (
              <div>
                <dt className="text-xs font-medium text-muted">Blood Group</dt>
                <dd className="mt-1 text-sm text-foreground">{lookup.patient.blood_group}</dd>
              </div>
            ) : null}
            {lookup.patient.address ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-muted">Address</dt>
                <dd className="mt-1 text-sm text-foreground">{lookup.patient.address}</dd>
              </div>
            ) : null}
          </dl>

          <div className="flex flex-wrap gap-3 pt-1">
            <Button type="button" onClick={() => openReturningForm(lookup)}>
              Register New Visit
            </Button>
            <Button type="button" variant="secondary" onClick={() => setStep('history')}>
              View History
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setLookup(null)
                setStep('search')
              }}
            >
              Search again
            </Button>
          </div>
        </div>
      )}

      {!isEdit && step === 'history' && lookup?.found && !lookup.multiple && (
        <div className="space-y-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-8">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Visit History</h3>
            <p className="mt-1 break-all text-sm text-muted">
              {lookup.patient.patient_name}
            </p>
          </div>
          <div className="space-y-3 lg:hidden">
            {visits.map((visit) => (
              <div key={visit.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">Visit #{visit.visit_number}</p>
                    <p className="mt-0.5 font-mono text-sm text-primary-600">
                      {formatTokenForUi(visit.token_number)}
                    </p>
                  </div>
                  <PatientStatusBadge status={visit.status} />
                </div>
                <p className="mt-2 text-sm text-muted">{formatDate(visit.created_at)}</p>
                <Link
                  to={`${listPath}/${visit.id}`}
                  className="mt-3 inline-block text-sm font-medium text-primary-600 hover:underline"
                >
                  View
                </Link>
              </div>
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-xl border border-border lg:block">
            <div className="table-scroll">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="border-b border-border bg-surface">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-2.5 font-medium text-muted">Visit</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-medium text-muted">Token</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-medium text-muted">Status</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-medium text-muted">Registered</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-medium text-muted"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visits.map((visit) => (
                    <tr key={visit.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-foreground">#{visit.visit_number}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-primary-600">
                        {formatTokenForUi(visit.token_number)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <PatientStatusBadge status={visit.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(visit.created_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        to={`${listPath}/${visit.id}`}
                        className="text-sm font-medium text-primary-600 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => openReturningForm(lookup)}>
              Register New Visit
            </Button>
            <Button type="button" variant="secondary" onClick={() => setStep('found')}>
              Back
            </Button>
          </div>
        </div>
      )}

      {step === 'form' && (
        <>
          {isReturningVisit && (
            <div className="mb-5 rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-800">
              Existing Patient Found — this will be registered as visit #{lookup.next_visit_number}.
              A new token will be issued for today.
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-8"
          >
            <Input
              id="mobile"
              label="Mobile Number"
              type="tel"
              placeholder="10-digit mobile number"
              error={errors.mobile}
              {...register('mobile', {
                required: 'Mobile number is required',
                pattern: {
                  value: /^[0-9]{10}$/,
                  message: 'Enter a valid 10-digit mobile number',
                },
              })}
            />

            <Input
              id="patient_name"
              label="Patient Name"
              placeholder="Enter full name"
              error={errors.patient_name}
              {...register('patient_name', { required: 'Patient name is required' })}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                id="age"
                label="Age"
                type="number"
                min="0"
                max="150"
                placeholder="Age"
                error={errors.age}
                {...register('age', {
                  required: 'Age is required',
                  min: { value: 0, message: 'Age must be positive' },
                  max: { value: 150, message: 'Enter a valid age' },
                })}
              />

              <Select
                id="gender"
                label="Gender"
                options={GENDERS}
                error={errors.gender}
                {...register('gender', { required: 'Gender is required' })}
              />
            </div>

            <Select
              id="blood_group"
              label="Blood Group"
              options={BLOOD_GROUPS}
              placeholder="Select blood group (optional)"
              error={errors.blood_group}
              {...register('blood_group')}
            />

            <div className="space-y-1">
              <label htmlFor="address" className="block text-sm font-medium text-foreground">
                Address
              </label>
              <textarea
                id="address"
                rows={3}
                placeholder="Patient address"
                className="block w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground shadow-sm placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                {...register('address')}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="chief_complaint" className="block text-sm font-medium text-foreground">
                Chief Complaint
              </label>
              <textarea
                id="chief_complaint"
                rows={3}
                placeholder="Reason for visit / symptoms"
                className={`block w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground shadow-sm placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${errors.chief_complaint ? 'border-red-500' : ''}`}
                {...register('chief_complaint', { required: 'Chief complaint is required' })}
              />
              {errors.chief_complaint && (
                <p className="text-sm text-red-500">{errors.chief_complaint.message}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? 'Saving...'
                  : isEdit
                    ? 'Update Patient'
                    : isReturningVisit
                      ? 'Register New Visit'
                      : 'Create New Patient'}
              </Button>
              {!isEdit && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStep(lookup?.found && !lookup.multiple ? 'found' : 'search')}
                >
                  Back
                </Button>
              )}
              <Link to={listPath}>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </>
      )}
      </div>
    </div>
  )
}

export function AdminPatientFormPage() {
  return (
    <PatientFormPage
      listPath={ROUTES.ADMIN_PATIENTS}
      isAdmin
    />
  )
}

export function ReceptionPatientFormPage() {
  return (
    <PatientFormPage
      listPath={ROUTES.RECEPTION_PATIENTS}
    />
  )
}
