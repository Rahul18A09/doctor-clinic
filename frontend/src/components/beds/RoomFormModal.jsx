import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { applyApiFieldErrors } from '@/components/beds/bedUtils'
import { Button, Input, Modal, ModalSpinner, Select } from '@/components/ui'
import { ROOM_TYPE_OPTIONS } from '@/utils/constants'

export function RoomFormModal({
  open,
  room,
  submitting,
  onClose,
  onSubmit,
}) {
  const isEdit = Boolean(room)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: {
      room_number: '',
      room_type: '',
      floor: '',
      capacity: 1,
      notes: '',
    },
  })

  useEffect(() => {
    if (!open) return
    reset({
      room_number: room?.room_number || '',
      room_type: room?.room_type || '',
      floor: room?.floor || '',
      capacity: room?.capacity ?? 1,
      notes: room?.notes || '',
    })
  }, [open, room, reset])

  const submit = async (values) => {
    try {
      await onSubmit({
        room_number: values.room_number.trim(),
        room_type: values.room_type,
        floor: values.floor.trim(),
        capacity: Number(values.capacity),
        notes: values.notes.trim(),
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
          {isEdit ? 'Edit Room' : 'Add Room'}
        </h3>
        <p className="mt-1 text-sm text-muted">
          {isEdit ? 'Update room details.' : 'Create a room for bed inventory.'}
        </p>
        <div className="mt-5 space-y-4">
          <Input
            id="room_number"
            label="Room Number"
            placeholder="101"
            error={errors.room_number}
            {...register('room_number', { required: 'Room number is required' })}
          />
          <Select
            id="room_type"
            label="Room Type"
            options={ROOM_TYPE_OPTIONS}
            placeholder="Select type"
            error={errors.room_type}
            {...register('room_type', { required: 'Room type is required' })}
          />
          <Input
            id="floor"
            label="Floor"
            placeholder="1"
            error={errors.floor}
            {...register('floor', { required: 'Floor is required' })}
          />
          <Input
            id="capacity"
            label="Capacity"
            type="number"
            min={1}
            max={200}
            error={errors.capacity}
            {...register('capacity', {
              required: 'Capacity is required',
              min: { value: 1, message: 'Capacity must be at least 1' },
              max: { value: 200, message: 'Capacity cannot exceed 200' },
            })}
          />
          <Input
            id="notes"
            label="Notes"
            placeholder="Optional notes"
            error={errors.notes}
            {...register('notes')}
          />
        </div>
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <ModalSpinner />}
            {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Room'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
