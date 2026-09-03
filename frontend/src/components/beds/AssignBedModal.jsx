import { useState } from 'react'
import { patientService } from '@/api/patients'
import { getBedsErrorMessage } from '@/api/beds'
import { Button, Input, Modal, ModalSpinner } from '@/components/ui'
import { formatTokenForUi } from '@/utils/formatToken'

export function AssignBedModal({
  open,
  bed,
  submitting,
  onClose,
  onAssign,
}) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [searchError, setSearchError] = useState('')

  const resetState = () => {
    setQuery('')
    setResults([])
    setSelected(null)
    setSearchError('')
  }

  const handleClose = () => {
    if (submitting) return
    resetState()
    onClose()
  }

  const handleSearch = async (event) => {
    event.preventDefault()
    const value = query.trim()
    if (!value) {
      setSearchError('Enter a name, mobile, or token.')
      return
    }
    setSearching(true)
    setSearchError('')
    setSelected(null)
    try {
      const { data: res } = await patientService.list({
        page: 1,
        page_size: 10,
        search: value,
        admission_status: 'Pending',
      })
      const rows = res.data?.results || []
      setResults(rows)
      if (rows.length === 0) setSearchError('No matching patients found.')
    } catch (error) {
      setResults([])
      setSearchError(getBedsErrorMessage(error, 'Could not search patients.'))
    } finally {
      setSearching(false)
    }
  }

  const handleAssign = async () => {
    if (!selected?.id) return
    try {
      await onAssign(selected.id)
      resetState()
    } catch {
      // Parent already showed the API error.
    }
  }

  return (
    <Modal open={open} onClose={handleClose} size="md" loading={submitting}>
      <div className="max-h-[min(90dvh,40rem)] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-8">
        <h3 className="text-lg font-semibold text-foreground">Assign Patient</h3>
        <p className="mt-1 text-sm text-muted">
          Assign a patient to bed {bed?.bed_number}. Only available beds can be assigned, and the
          patient must have admission pending.
        </p>

        <form onSubmit={handleSearch} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <div className="min-w-0 flex-1">
            <Input
              id="assign_patient_search"
              placeholder="Search by name, mobile, or token"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={searching || submitting}>
            {searching ? 'Searching...' : 'Search'}
          </Button>
        </form>

        {searchError && <p className="mt-3 text-sm text-red-500">{searchError}</p>}

        {results.length > 0 && (
          <ul className="mt-4 space-y-2">
            {results.map((patient) => {
              const active = selected?.id === patient.id
              return (
                <li key={patient.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(patient)}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                      active
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-border bg-surface hover:border-primary-300'
                    }`}
                  >
                    <p className="font-medium text-foreground">{patient.patient_name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatTokenForUi(patient.token_number)} · {patient.mobile} · Visit #
                      {patient.visit_number || 1}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleAssign} disabled={submitting || !selected}>
            {submitting && <ModalSpinner />}
            {submitting ? 'Assigning...' : 'Assign Bed'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
