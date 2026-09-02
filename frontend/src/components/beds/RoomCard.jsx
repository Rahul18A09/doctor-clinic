import { DeleteIconButton, EditIconButton, ViewIconButton } from '@/components/patients/ViewIconButton'
import { BedStatusBadge } from '@/components/beds/BedStatusBadge'
import { canAssignBed, canReleaseBed, countBedsByStatus, roomTypeLabel } from '@/components/beds/bedUtils'
import { Button } from '@/components/ui'

function CountChip({ label, value, className }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>
      <span>{label}</span>
      <span>{value}</span>
    </span>
  )
}

function BedRow({
  bed,
  patient,
  canManage,
  onViewBed,
  onEditBed,
  onDeleteBed,
  onChangeStatus,
  onAssign,
  onRelease,
}) {
  const patientLabel = patient?.patient_name || (bed.patient_id ? 'Assigned patient' : null)

  return (
    <div className="rounded-xl border border-border bg-surface/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">Bed {bed.bed_number}</p>
          {patientLabel && (
            <p className="mt-0.5 truncate text-xs text-muted">{patientLabel}</p>
          )}
        </div>
        <BedStatusBadge status={bed.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-1">
        {onViewBed && <ViewIconButton onClick={() => onViewBed(bed)} />}
        {canAssignBed(bed) && (
          <Button size="sm" variant="secondary" onClick={() => onAssign(bed)}>
            Assign
          </Button>
        )}
        {canReleaseBed(bed) && (
          <Button size="sm" variant="secondary" onClick={() => onRelease(bed)}>
            Release
          </Button>
        )}
        {canManage && (
          <>
            <Button size="sm" variant="ghost" onClick={() => onChangeStatus(bed)}>
              Status
            </Button>
            <EditIconButton onClick={() => onEditBed(bed)} />
            <DeleteIconButton onClick={() => onDeleteBed(bed)} />
          </>
        )}
      </div>
    </div>
  )
}

export function RoomCard({
  room,
  beds = [],
  patientsById = {},
  canManage = false,
  onViewRoom,
  onEditRoom,
  onDeleteRoom,
  onAddBed,
  onViewBed,
  onEditBed,
  onDeleteBed,
  onChangeStatus,
  onAssign,
  onRelease,
}) {
  const counts = countBedsByStatus(beds)
  const canAddBed = canManage && beds.length < (room.capacity || 0)

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">Room {room.room_number}</h3>
            <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
              {roomTypeLabel(room.room_type)}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            Floor {room.floor || '—'} · Capacity {room.capacity ?? 0} · {beds.length} bed
            {beds.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ViewIconButton onClick={() => onViewRoom(room)} />
          {canManage && (
            <>
              <EditIconButton onClick={() => onEditRoom(room)} />
              <DeleteIconButton onClick={() => onDeleteRoom(room)} />
            </>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <CountChip label="Available" value={counts.available} className="bg-emerald-50 text-emerald-700" />
        <CountChip label="Occupied" value={counts.occupied} className="bg-sky-50 text-sky-700" />
        <CountChip label="Reserved" value={counts.reserved} className="bg-amber-50 text-amber-700" />
        <CountChip label="Maintenance" value={counts.maintenance} className="bg-gray-100 text-gray-700" />
        {counts.blocked > 0 && (
          <CountChip label="Blocked" value={counts.blocked} className="bg-red-50 text-red-700" />
        )}
      </div>

      {beds.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No beds in this room.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {beds.map((bed) => (
            <BedRow
              key={bed.id}
              bed={bed}
              patient={patientsById[bed.patient_id]}
              canManage={canManage}
              onViewBed={onViewBed}
              onEditBed={onEditBed}
              onDeleteBed={onDeleteBed}
              onChangeStatus={onChangeStatus}
              onAssign={onAssign}
              onRelease={onRelease}
            />
          ))}
        </div>
      )}

      {canAddBed && (
        <div className="mt-4">
          <Button variant="secondary" size="sm" onClick={() => onAddBed(room)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Bed
          </Button>
        </div>
      )}
    </article>
  )
}
