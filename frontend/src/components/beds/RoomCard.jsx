import { useState } from 'react'
import {
  LuBedDouble,
  LuBuilding2,
  LuChevronDown,
  LuEye,
  LuPencil,
  LuPlus,
  LuTrash2,
  LuUserPlus,
} from 'react-icons/lu'
import { BedStatusBadge } from '@/components/beds/BedStatusBadge'
import {
  canAssignBed,
  canReleaseBed,
  countBedsByStatus,
  roomTypeBadgeClass,
  roomTypeLabel,
} from '@/components/beds/bedUtils'
import { Button } from '@/components/ui'

function CountChip({ label, value, className }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${className}`}>
      <span>{label}</span>
      <span>{value}</span>
    </span>
  )
}

function IconAction({ label, onClick, className = '', children }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-primary-600 ${className}`}
    >
      {children}
    </button>
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
    <div className="rounded-xl border border-border bg-card p-3 sm:p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
            <LuBedDouble className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">Bed {bed.bed_number}</p>
            {patientLabel && (
              <p className="mt-0.5 truncate text-xs text-muted">{patientLabel}</p>
            )}
          </div>
        </div>
        <BedStatusBadge status={bed.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-1.5">
        {onViewBed && (
          <IconAction label="View bed" onClick={() => onViewBed(bed)}>
            <LuEye className="h-4 w-4" />
          </IconAction>
        )}
        {canAssignBed(bed) && (
          <button
            type="button"
            onClick={() => onAssign(bed)}
            className={`inline-flex items-center justify-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              canManage
                ? 'border-border bg-white text-foreground hover:bg-surface'
                : 'border-emerald-400 bg-white text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <LuUserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            {canManage ? 'Assign' : '+ Assign'}
          </button>
        )}
        {canReleaseBed(bed) && (
          <button
            type="button"
            onClick={() => onRelease(bed)}
            className="inline-flex items-center justify-center rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50"
          >
            Release
          </button>
        )}
        {canManage && (
          <>
            <button
              type="button"
              onClick={() => onChangeStatus(bed)}
              className="inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
            >
              Status
            </button>
            <IconAction label="Edit bed" onClick={() => onEditBed(bed)}>
              <LuPencil className="h-4 w-4" />
            </IconAction>
            <IconAction
              label="Delete bed"
              onClick={() => onDeleteBed(bed)}
              className="text-red-500 hover:bg-red-50 hover:text-red-600"
            >
              <LuTrash2 className="h-4 w-4" />
            </IconAction>
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
  const [expanded, setExpanded] = useState(false)
  const counts = countBedsByStatus(beds)
  const canAddBed = canManage && beds.length < (room.capacity || 0)

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between lg:gap-4 sm:p-5">
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
          aria-expanded={expanded}
        >
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <LuBuilding2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-foreground sm:text-lg">
                Room {room.room_number}
              </h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${roomTypeBadgeClass(room.room_type)}`}
              >
                {roomTypeLabel(room.room_type)}
              </span>
            </span>
            <p className="mt-1 text-sm text-muted">
              Floor {room.floor || '—'} • Capacity {room.capacity ?? 0} • {beds.length} bed
              {beds.length === 1 ? '' : 's'}
            </p>
          </span>
        </button>

        <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
          <CountChip label="Available" value={counts.available} className="bg-emerald-50 text-emerald-700" />
          <CountChip label="Occupied" value={counts.occupied} className="bg-sky-50 text-sky-700" />
          <CountChip label="Reserved" value={counts.reserved} className="bg-amber-50 text-amber-700" />
          <CountChip label="Maintenance" value={counts.maintenance} className="bg-red-50 text-red-700" />
          {counts.blocked > 0 && (
            <CountChip label="Blocked" value={counts.blocked} className="bg-gray-100 text-gray-700" />
          )}

          <div className="ml-auto flex shrink-0 items-center gap-0.5 lg:ml-1">
            {onViewRoom && (
              <IconAction label="View room" onClick={() => onViewRoom(room)}>
                <LuEye className="h-4 w-4" />
              </IconAction>
            )}
            {canManage && (
              <>
                <IconAction label="Edit room" onClick={() => onEditRoom(room)}>
                  <LuPencil className="h-4 w-4" />
                </IconAction>
                <IconAction
                  label="Delete room"
                  onClick={() => onDeleteRoom(room)}
                  className="text-red-500 hover:bg-red-50 hover:text-red-600"
                >
                  <LuTrash2 className="h-4 w-4" />
                </IconAction>
              </>
            )}
            <IconAction
              label={expanded ? 'Collapse room' : 'Expand room'}
              onClick={() => setExpanded((open) => !open)}
            >
              <LuChevronDown
                className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            </IconAction>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 sm:px-5 sm:pb-5">
          {beds.length === 0 ? (
            <p className="pt-4 text-sm text-muted">No beds in this room.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 pt-4 sm:grid-cols-2 xl:grid-cols-3">
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
            <div className="pt-4">
              <Button variant="secondary" size="sm" onClick={() => onAddBed(room)}>
                <LuPlus className="h-4 w-4" aria-hidden="true" />
                Add Bed
              </Button>
            </div>
          )}
        </div>
      )}
    </article>
  )
}
