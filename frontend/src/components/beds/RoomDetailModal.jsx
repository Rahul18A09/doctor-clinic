import { BedStatusBadge } from '@/components/beds/BedStatusBadge'
import { formatAssignedAt, roomTypeLabel } from '@/components/beds/bedUtils'
import { Button, Modal } from '@/components/ui'

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-foreground">{value || '—'}</dd>
    </div>
  )
}

export function RoomDetailModal({
  open,
  room,
  beds = [],
  bed,
  patientsById = {},
  onClose,
}) {
  const title = bed ? `Bed ${bed.bed_number}` : room ? `Room ${room.room_number}` : 'Details'
  const patient = bed?.patient_id ? patientsById[bed.patient_id] : null

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <div className="max-h-[min(90dvh,40rem)] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-8">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {room && (
          <dl className="mt-4 space-y-2">
            <Row label="Room number" value={room.room_number} />
            <Row label="Type" value={roomTypeLabel(room.room_type)} />
            <Row label="Floor" value={room.floor} />
            <Row label="Capacity" value={room.capacity} />
            <Row label="Beds" value={room.bed_count ?? beds.length} />
            <Row label="Available" value={room.available_count} />
            {room.notes ? <Row label="Notes" value={room.notes} /> : null}
          </dl>
        )}

        {bed && (
          <dl className="mt-4 space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <dt className="text-muted">Status</dt>
              <dd>
                <BedStatusBadge status={bed.status} />
              </dd>
            </div>
            <Row label="Patient" value={patient?.patient_name} />
            <Row label="Assigned at" value={formatAssignedAt(bed.assigned_at)} />
          </dl>
        )}

        {!bed && beds.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-sm font-medium text-foreground">Beds</p>
            {beds.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2"
              >
                <span className="text-sm font-medium text-foreground">Bed {item.bed_number}</span>
                <BedStatusBadge status={item.status} />
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}
