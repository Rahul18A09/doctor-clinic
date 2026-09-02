import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { applyApiFieldErrors } from '@/components/beds/bedUtils'
import { Button, Modal, ModalSpinner, Select } from '@/components/ui'
import { BED_STATUS_WRITE_OPTIONS } from '@/utils/constants'

export function ChangeStatusModal({
  open,
  bed,
  submitting,
  onClose,
  onSubmit,
}) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: { status: 'available' },
  })

  useEffect(() => {
    if (!open) return
    reset({
      status: bed?.status && bed.status !== 'occupied' ? bed.status : 'available',
    })
  }, [open, bed, reset])

  const submit = async (values) => {
    try {
      await onSubmit(values.status)
    } catch (error) {
      applyApiFieldErrors(setError, error)
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="sm" loading={submitting}>
      <form
        onSubmit={handleSubmit(submit)}
        className="rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-8"
      >
        <h3 className="text-lg font-semibold text-foreground">Change Bed Status</h3>
        <p className="mt-1 text-sm text-muted">
          Bed {bed?.bed_number}. Occupied beds must be released first. Use Assign to occupy a bed.
        </p>
        <div className="mt-5">
          <Select
            id="change_bed_status"
            label="Status"
            options={BED_STATUS_WRITE_OPTIONS}
            placeholder="Select status"
            error={errors.status}
            {...register('status', { required: 'Status is required' })}
          />
        </div>
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || bed?.status === 'occupied'}>
            {submitting && <ModalSpinner />}
            {submitting ? 'Saving...' : 'Update Status'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
