import { Modal, ModalSpinner } from '@/components/ui/Modal'

const CONFIRM_VARIANTS = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700',
  danger: 'bg-red-600 text-white hover:bg-red-700',
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal open={open} onClose={onCancel} size="md" loading={loading}>
      <div className="overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-8">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted">{message}</p>
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="w-full rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto ${CONFIRM_VARIANTS[variant] || CONFIRM_VARIANTS.danger}`}
          >
            {loading && <ModalSpinner />}
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
