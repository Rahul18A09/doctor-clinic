import { useEffect, useState } from 'react'
import { bedService, getBedsErrorMessage, roomService } from '@/api/beds'
import { Button, Modal, ModalSpinner } from '@/components/ui'
import { roomTypeLabel } from '@/components/beds/bedUtils'

function stepClass(active) {
  return active
    ? 'border-primary-500 bg-primary-50'
    : 'border-border bg-surface hover:border-primary-300'
}

export function AssignPatientToBedModal({
  open,
  patient,
  submitting,
  onClose,
  onAssign,
}) {
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [loadingBeds, setLoadingBeds] = useState(false)
  const [rooms, setRooms] = useState([])
  const [beds, setBeds] = useState([])
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [selectedBed, setSelectedBed] = useState(null)
  const [error, setError] = useState('')

  const resetState = () => {
    setRooms([])
    setBeds([])
    setSelectedRoom(null)
    setSelectedBed(null)
    setError('')
  }

  const handleClose = () => {
    if (submitting) return
    resetState()
    onClose()
  }

  useEffect(() => {
    if (!open) return undefined
    const controller = new AbortController()
    let cancelled = false

    async function loadRooms() {
      setLoadingRooms(true)
      setError('')
      setSelectedRoom(null)
      setSelectedBed(null)
      setBeds([])
      try {
        const { data: res } = await roomService.list(
          { page: 1, page_size: 100 },
          { signal: controller.signal },
        )
        if (cancelled) return
        const rows = (res.data?.results || []).filter((room) => (room.available_count || 0) > 0)
        setRooms(rows)
        if (rows.length === 0) {
          setError('No rooms currently have available beds.')
        }
      } catch (err) {
        if (cancelled || err?.code === 'ERR_CANCELED') return
        setRooms([])
        setError(getBedsErrorMessage(err, 'Could not load rooms.'))
      } finally {
        if (!cancelled) setLoadingRooms(false)
      }
    }

    loadRooms()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [open])

  const handleSelectRoom = async (room) => {
    setSelectedRoom(room)
    setSelectedBed(null)
    setBeds([])
    setError('')
    setLoadingBeds(true)
    try {
      const { data: res } = await bedService.listAvailable({
        page: 1,
        page_size: 100,
        room_id: room.id,
      })
      const rows = res.data?.results || []
      setBeds(rows)
      if (rows.length === 0) {
        setError('This room has no available beds.')
      }
    } catch (err) {
      setBeds([])
      setError(getBedsErrorMessage(err, 'Could not load available beds.'))
    } finally {
      setLoadingBeds(false)
    }
  }

  const handleConfirm = async () => {
    if (!selectedBed?.id) return
    try {
      await onAssign(selectedBed.id)
      resetState()
    } catch {
      // Parent already showed the API error.
    }
  }

  return (
    <Modal open={open} onClose={handleClose} size="md" loading={submitting}>
      <div className="max-h-[min(90dvh,42rem)] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-8">
        <h3 className="text-lg font-semibold text-foreground">Assign Bed</h3>
        <p className="mt-1 text-sm text-muted">
          Select a room, then an available bed for {patient?.patient_name || 'this patient'}. Only
          available beds are shown. Occupied, reserved, maintenance, and blocked beds cannot be assigned.
        </p>

        <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">1. Select room</p>
        {loadingRooms ? (
          <p className="mt-3 text-sm text-muted">Loading rooms...</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {rooms.map((room) => {
              const active = selectedRoom?.id === room.id
              return (
                <li key={room.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectRoom(room)}
                    disabled={submitting}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${stepClass(active)}`}
                  >
                    <p className="font-medium text-foreground">Room {room.room_number}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {roomTypeLabel(room.room_type)} · Floor {room.floor} · {room.available_count}{' '}
                      available
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {selectedRoom && (
          <>
            <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">
              2. Select available bed
            </p>
            {loadingBeds ? (
              <p className="mt-3 text-sm text-muted">Loading beds...</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {beds.map((bed) => {
                  const active = selectedBed?.id === bed.id
                  return (
                    <li key={bed.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedBed(bed)}
                        disabled={submitting}
                        className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${stepClass(active)}`}
                      >
                        <p className="font-medium text-foreground">Bed {bed.bed_number}</p>
                        <p className="mt-0.5 text-xs text-muted">Available</p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        {selectedBed && selectedRoom && (
          <p className="mt-5 rounded-xl bg-surface px-3 py-3 text-sm text-foreground">
            Confirm: assign {patient?.patient_name || 'patient'} to bed {selectedBed.bed_number} in room{' '}
            {selectedRoom.room_number}.
          </p>
        )}

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={submitting || !selectedBed}>
            {submitting && <ModalSpinner />}
            {submitting ? 'Assigning...' : 'Confirm'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
