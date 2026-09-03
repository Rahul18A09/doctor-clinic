import { Modal, ModalSpinner } from '@/components/ui/Modal'

function MedicalWarningIcon() {
  return (
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
      <svg
        className="h-7 w-7 text-amber-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01M10.29 3.86l-7.4 12.84A2 2 0 004.53 20h14.94a2 2 0 001.64-2.3L13.71 3.86a2 2 0 00-3.42 0z"
        />
      </svg>
    </div>
  )
}

const COMPLETION_NOTES = [
  'Visit status will change to Completed.',
  'The patient will move to the Visit Completed list.',
  'This does not discharge an Inpatient or release a bed.',
  'Receptionist can no longer edit this patient.',
]

export function CompleteTreatmentDialog({
  open,
  patientName,
  tokenNumber,
  loading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal open={open} onClose={onCancel} size="lg" loading={loading}>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="px-4 pb-2 pt-6 text-center sm:px-8 sm:pt-8">
          <MedicalWarningIcon />
          <h3 className="mt-5 text-xl font-semibold text-foreground">Complete Treatment</h3>
          <p className="mt-2 text-sm text-muted">
            You are about to complete this consultation.
          </p>
        </div>

        <div className="space-y-5 px-4 py-6 sm:px-8">
          <div className="rounded-xl border border-border bg-surface/60 px-5 py-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                  Patient Name
                </dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">
                  {patientName || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                  Token Number
                </dt>
                <dd className="mt-1 font-mono text-sm font-semibold text-primary-600">
                  {tokenNumber || '—'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">
            <div className="flex gap-3">
              <svg
                className="mt-0.5 h-5 w-5 shrink-0 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <ul className="space-y-2 text-sm text-blue-900">
                {COMPLETION_NOTES.map((note) => (
                  <li key={note} className="flex gap-2">
                    <span className="text-blue-400">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-border bg-surface/40 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="w-full rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
          >
            {loading && <ModalSpinner />}
            {loading ? 'Completing...' : 'Complete Treatment'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
