import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { applyApiFieldErrors } from '@/components/beds/bedUtils'
import { Button, Input, Modal, ModalSpinner, Select } from '@/components/ui'
import { BED_STATUS_WRITE_OPTIONS } from '@/utils/constants'

export function BedFormModal({
  open,
  bed,
  room,
  submitting,
  onClose,
  onSubmit,
}) {
  const isEdit = Boolean(bed)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: {
      bed_number: '',
      status: 'available',
    },
  })

  useEffect(() => {
    if (!open) return
    reset({
      bed_number: bed?.bed_number || '',
      status: bed?.status && bed.status !== 'occupied' ? bed.status : 'available',
    })
  }, [open, bed, reset])

  const submit = async (values) => {
    try {
      await onSubmit({
        bed_number: values.bed_number.trim(),
        status: values.status,
      })
    } catch (error) {
      applyApiFieldErrors(setError, error)
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="md" loading={submitting}>
      <form
        onSubmit={handleSubmit(submit)}
        className="max-h-[min(90dvh,40rem)] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-8"
      >
        <h3 className="text-lg font-semibold text-foreground">
          {isEdit ? 'Edit Bed' : 'Add Bed'}
        </h3>
        <p className="mt-1 text-sm text-muted">
          {isEdit
            ? `Update bed number in room ${room?.room_number || ''}.`
            : `Add a bed to room ${room?.room_number || ''}.`}
        </p>
        <div className="mt-5 space-y-4">
          <Input
            id="bed_number"
            label="Bed Number"
            placeholder="A"
            error={errors.bed_number}
            {...register('bed_number', { required: 'Bed number is required' })}
          />
          <Select
            id="bed_status"
            label="Status"
            options={BED_STATUS_WRITE_OPTIONS}
            placeholder="Select status"
            disabled={isEdit && bed?.status === 'occupied'}
            error={errors.status}
            {...register('status', { required: 'Status is required' })}
          />
        </div>
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <ModalSpinner />}
            {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Bed'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
