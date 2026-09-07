import { useCallback, useEffect, useRef, useState } from 'react'
import { bedService, getBedsErrorMessage, roomService } from '@/api/beds'
import { AssignBedModal } from '@/components/beds/AssignBedModal'
import { BedFormModal } from '@/components/beds/BedFormModal'
import { BedStatCard } from '@/components/beds/BedStatCard'
import { ChangeStatusModal } from '@/components/beds/ChangeStatusModal'
import { ROOM_TYPE_FORM_OPTIONS } from '@/components/beds/bedUtils'
import { RoomCard } from '@/components/beds/RoomCard'
import { RoomDetailModal } from '@/components/beds/RoomDetailModal'
import { RoomFormModal } from '@/components/beds/RoomFormModal'
import {
  Button,
  ConfirmDialog,
  getAppliedSearchFromInput,
  ListStatus,
  RefreshButton,
  Select,
} from '@/components/ui'
import { useToast } from '@/context/ToastContext'
import { useNotifications } from '@/hooks/useNotifications'
import {
  BED_STATUS,
  BED_STATUS_FILTER_OPTIONS,
} from '@/utils/constants'
import {
  LuBedDouble,
  LuCalendar,
  LuPlus,
  LuSearch,
  LuUser,
  LuWrench,
  LuBuilding2,
} from 'react-icons/lu'

const EMPTY_SUMMARY = {
  total: 0,
  available: 0,
  occupied: 0,
  reserved: 0,
  maintenance: 0,
  blocked: 0,
}

const ICON_CLASS = 'h-5 w-5 sm:h-6 sm:w-6'

function getSummaryCards(canManage) {
  const bedCards = [
    {
      key: 'total',
      title: 'Total Beds',
      hint: 'All configured beds',
      tone: canManage ? 'purple' : 'green',
      status: '',
      icon: <LuBedDouble className={ICON_CLASS} aria-hidden="true" />,
    },
    {
      key: 'available',
      title: 'Available',
      hint: 'Beds available',
      tone: 'green',
      status: BED_STATUS.AVAILABLE,
      icon: <LuBedDouble className={ICON_CLASS} aria-hidden="true" />,
    },
    {
      key: 'occupied',
      title: 'Occupied',
      hint: 'Beds occupied',
      tone: 'sky',
      status: BED_STATUS.OCCUPIED,
      icon: <LuUser className={ICON_CLASS} aria-hidden="true" />,
    },
    {
      key: 'reserved',
      title: 'Reserved',
      hint: 'Beds reserved',
      tone: 'orange',
      status: BED_STATUS.RESERVED,
      icon: <LuCalendar className={ICON_CLASS} aria-hidden="true" />,
    },
    {
      key: 'maintenance',
      title: 'Maintenance',
      hint: 'Under maintenance',
      tone: 'red',
      status: BED_STATUS.MAINTENANCE,
      icon: <LuWrench className={ICON_CLASS} aria-hidden="true" />,
    },
  ]

  if (!canManage) return bedCards

  return [
    {
      key: 'rooms',
      title: 'Total Rooms',
      hint: 'Rooms created',
      tone: 'blue',
      status: '',
      icon: <LuBuilding2 className={ICON_CLASS} aria-hidden="true" />,
    },
    ...bedCards,
  ]
}

function patientsByIdFromBeds(rows) {
  const map = {}
  for (const row of rows) {
    for (const bed of row.beds || []) {
      if (bed.patient_id && bed.patient_name && !map[bed.patient_id]) {
        map[bed.patient_id] = {
          id: bed.patient_id,
          patient_name: bed.patient_name,
        }
      }
    }
  }
  return map
}

function splitRoomWithBeds(entry) {
  const beds = Array.isArray(entry?.beds) ? entry.beds : []
  const { beds: _beds, ...room } = entry || {}
  return { room, beds }
}

export function BedManagementPage({
  canManage = false,
  title = 'Beds',
  subtitle = 'View rooms and bed availability.',
}) {
  const { showSuccess, showError } = useToast()
  const { refresh: refreshNotifications } = useNotifications()
  const skipAutoFetchRef = useRef(false)

  const [summary, setSummary] = useState(EMPTY_SUMMARY)
  const [totalRooms, setTotalRooms] = useState(0)
  const [rooms, setRooms] = useState([])
  const [patientsById, setPatientsById] = useState({})
  const [floors, setFloors] = useState([])
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({
    total_pages: 1,
    total: 0,
    has_next: false,
    has_previous: false,
  })
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [roomType, setRoomType] = useState('')
  const [floor, setFloor] = useState('')
  const [bedStatus, setBedStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [roomForm, setRoomForm] = useState({ open: false, room: null })
  const [bedForm, setBedForm] = useState({ open: false, room: null, bed: null })
  const [statusForm, setStatusForm] = useState({ open: false, bed: null })
  const [assignForm, setAssignForm] = useState({ open: false, bed: null })
  const [detail, setDetail] = useState({ open: false, room: null, beds: [], bed: null })
  const [confirm, setConfirm] = useState({
    open: false,
    type: '',
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    payload: null,
  })

  const fetchData = useCallback(
    async ({ silent = false, search: searchOverride, page: pageOverride } = {}) => {
      if (!silent) setLoading(true)
      const appliedSearch = searchOverride !== undefined ? searchOverride : search
      const appliedPage = pageOverride !== undefined ? pageOverride : page
      try {
        const roomParams = {
          include_beds: true,
          search: appliedSearch,
        }
        if (roomType) roomParams.room_type = roomType
        if (floor) roomParams.floor = floor

        let filtered = []
        let paginationMeta = {
          total_pages: 1,
          total: 0,
          has_next: false,
          has_previous: false,
        }

        const [summaryRes, roomsRes] = await Promise.all([
          bedService.summary(),
          bedStatus
            ? roomService.list({ ...roomParams, page: 1, page_size: 100 })
            : roomService.list({ ...roomParams, page: appliedPage, page_size: 10 }),
        ])

        const listed = roomsRes.data?.data?.results || []

        if (bedStatus) {
          filtered = listed
            .map((entry) => {
              const { room, beds } = splitRoomWithBeds(entry)
              return {
                room,
                beds: beds.filter((bed) => bed.status === bedStatus),
              }
            })
            .filter((row) => row.beds.length > 0)
          paginationMeta = {
            total_pages: 1,
            total: filtered.length,
            has_next: false,
            has_previous: false,
          }
        } else {
          filtered = listed.map(splitRoomWithBeds)
          paginationMeta = roomsRes.data?.data?.pagination || paginationMeta
        }

        const summaryPayload = summaryRes.data?.data || {}
        setSummary(summaryPayload.summary || EMPTY_SUMMARY)
        setTotalRooms(summaryPayload.total_rooms ?? 0)
        setFloors(Array.isArray(summaryPayload.floors) ? summaryPayload.floors : [])
        setRooms(filtered)
        setPatientsById(patientsByIdFromBeds(filtered))
        setPagination(paginationMeta)
        setLoadError('')
      } catch (err) {
        const message = getBedsErrorMessage(err, 'Could not load rooms and beds.')
        if (!silent) {
          setLoadError(message)
          showError(message)
        }
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [page, search, roomType, floor, bedStatus, showError],
  )

  useEffect(() => {
    if (skipAutoFetchRef.current) {
      skipAutoFetchRef.current = false
      return
    }
    fetchData()
  }, [fetchData])

  const reload = async () => {
    await fetchData({ silent: true })
  }

  const openBedDetail = async (room, beds, bed) => {
    try {
      const { data: res } = await bedService.get(bed.id)
      const nextBed = res.data?.bed || bed
      if (nextBed?.patient_id && nextBed?.patient_name) {
        setPatientsById((prev) => ({
          ...prev,
          [nextBed.patient_id]: {
            id: nextBed.patient_id,
            patient_name: nextBed.patient_name,
          },
        }))
      }
      setDetail({ open: true, room, beds, bed: nextBed })
    } catch (error) {
      showError(getBedsErrorMessage(error, 'Could not load bed details.'))
      setDetail({ open: true, room, beds, bed })
    }
  }

  const handleRefresh = async () => {
    if (refreshing) return
    const { nextSearch, searchChanged, nextPage } = getAppliedSearchFromInput(
      searchInput,
      search,
      page,
    )
    if (searchChanged) {
      skipAutoFetchRef.current = true
      setSearch(nextSearch)
      setPage(nextPage)
    }
    setRefreshing(true)
    try {
      await fetchData({ silent: true, search: nextSearch, page: nextPage })
    } finally {
      setRefreshing(false)
    }
  }

  const handleSearch = (event) => {
    event.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  const closeConfirm = () => {
    if (submitting) return
    setConfirm((prev) => ({ ...prev, open: false, payload: null }))
  }

  const handleRoomSubmit = async (values) => {
    if (!canManage) return
    setSubmitting(true)
    try {
      if (roomForm.room) {
        await roomService.update(roomForm.room.id, values)
        showSuccess('Room updated successfully.')
      } else {
        await roomService.create(values)
        showSuccess('Room created successfully.')
      }
      setRoomForm({ open: false, room: null })
      await reload()
    } catch (error) {
      showError(getBedsErrorMessage(error, 'Could not save room.'))
      throw error
    } finally {
      setSubmitting(false)
    }
  }

  const handleBedSubmit = async (values) => {
    if (!canManage) return
    setSubmitting(true)
    try {
      if (bedForm.bed) {
        const payload = { bed_number: values.bed_number }
        if (bedForm.bed.status !== BED_STATUS.OCCUPIED) {
          payload.status = values.status
        }
        await bedService.update(bedForm.bed.id, payload)
        showSuccess('Bed updated successfully.')
      } else {
        await bedService.create({
          room_id: bedForm.room.id,
          bed_number: values.bed_number,
          status: values.status,
        })
        showSuccess('Bed created successfully.')
      }
      setBedForm({ open: false, room: null, bed: null })
      await reload()
    } catch (error) {
      showError(getBedsErrorMessage(error, 'Could not save bed.'))
      throw error
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusSubmit = async (status) => {
    if (!canManage) return
    setSubmitting(true)
    try {
      await bedService.updateStatus(statusForm.bed.id, { status })
      showSuccess('Bed status updated successfully.')
      setStatusForm({ open: false, bed: null })
      await reload()
      void refreshNotifications()
    } catch (error) {
      showError(getBedsErrorMessage(error, 'Could not update bed status.'))
      throw error
    } finally {
      setSubmitting(false)
    }
  }

  const handleAssign = async (patientId) => {
    setSubmitting(true)
    try {
      await bedService.assign(assignForm.bed.id, { patient_id: patientId })
      showSuccess('Bed assigned successfully.')
      setAssignForm({ open: false, bed: null })
      await reload()
      void refreshNotifications()
    } catch (error) {
      showError(getBedsErrorMessage(error, 'Could not assign patient.'))
      throw error
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirm = async () => {
    if (confirm.type !== 'release' && !canManage) return
    setSubmitting(true)
    try {
      if (confirm.type === 'deleteRoom') {
        await roomService.delete(confirm.payload.id)
        showSuccess('Room deleted successfully.')
      } else if (confirm.type === 'deleteBed') {
        await bedService.delete(confirm.payload.id)
        showSuccess('Bed deleted successfully.')
      } else if (confirm.type === 'release') {
        await bedService.release(confirm.payload.id)
        showSuccess('Bed released successfully.')
      }
      setConfirm({ open: false, type: '', title: '', message: '', confirmLabel: 'Confirm', payload: null })
      await reload()
      if (confirm.type === 'release') void refreshNotifications()
    } catch (error) {
      showError(getBedsErrorMessage(error, 'Could not complete this action.'))
    } finally {
      setSubmitting(false)
    }
  }

  const floorOptions = floors.map((value) => ({ value, label: `Floor ${value}` }))
  const showListStatus = rooms.length === 0
  const summaryCards = getSummaryCards(canManage)
  const summaryGridClass = canManage
    ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6'
    : 'grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5'

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        {canManage && (
          <Button className="w-full shrink-0 sm:w-auto" onClick={() => setRoomForm({ open: true, room: null })}>
            <LuPlus className="h-4 w-4" aria-hidden="true" />
            Add Room
          </Button>
        )}
      </div>

      <div className={summaryGridClass}>
        {summaryCards.map((card) => (
          <BedStatCard
            key={card.key}
            title={card.title}
            value={loading ? '—' : String(card.key === 'rooms' ? totalRooms : summary[card.key] ?? 0)}
            hint={card.hint}
            tone={card.tone}
            icon={card.icon}
            active={bedStatus === card.status && card.key !== 'rooms'}
            onClick={() => {
              setPage(1)
              setBedStatus(card.status)
            }}
          />
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <form onSubmit={handleSearch} className="min-w-0 flex-1">
            <label className="relative block">
              <LuSearch
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search room or bed..."
                className="w-full rounded-xl border border-border bg-white py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </label>
          </form>
          <div className={`flex flex-col gap-3 sm:flex-row sm:items-center ${canManage ? 'lg:contents' : ''}`}>
            {!canManage && <RefreshButton onClick={handleRefresh} loading={refreshing} className="w-full sm:w-auto" />}
            <Select
              options={ROOM_TYPE_FORM_OPTIONS}
              placeholder="All Room Types"
              value={roomType}
              onChange={(event) => {
                setPage(1)
                setRoomType(event.target.value)
              }}
              className="w-full min-w-0 sm:flex-1 lg:w-44 lg:flex-none"
            />
            <Select
              options={floorOptions}
              placeholder="All Floors"
              value={floor}
              onChange={(event) => {
                setPage(1)
                setFloor(event.target.value)
              }}
              className="w-full min-w-0 sm:flex-1 lg:w-36 lg:flex-none"
            />
            <Select
              options={BED_STATUS_FILTER_OPTIONS}
              placeholder="All Bed Statuses"
              value={bedStatus}
              onChange={(event) => {
                setPage(1)
                setBedStatus(event.target.value)
              }}
              className="w-full min-w-0 sm:flex-1 lg:w-44 lg:flex-none"
            />
            {canManage && <RefreshButton onClick={handleRefresh} loading={refreshing} className="w-full sm:w-auto" />}
          </div>
        </div>
      </div>

      {showListStatus ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <ListStatus
            loading={loading}
            error={loadError}
            empty={!loading && !loadError}
            emptyLabel={
              search || roomType || floor || bedStatus
                ? 'No rooms match the current filters.'
                : 'No rooms found.'
            }
            onRetry={() => fetchData()}
          />
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {rooms.map(({ room, beds }) => (
              <RoomCard
                key={room.id}
                room={room}
                beds={beds}
                patientsById={patientsById}
                canManage={canManage}
                onViewRoom={() => setDetail({ open: true, room, beds, bed: null })}
                onEditRoom={() => setRoomForm({ open: true, room })}
                onDeleteRoom={() =>
                  setConfirm({
                    open: true,
                    type: 'deleteRoom',
                    title: 'Delete Room',
                    message: `Delete room ${room.room_number}? Occupied or reserved beds block deletion.`,
                    confirmLabel: 'Delete',
                    payload: room,
                  })
                }
                onAddBed={() => setBedForm({ open: true, room, bed: null })}
                onViewBed={(bed) => openBedDetail(room, beds, bed)}
                onEditBed={(bed) => setBedForm({ open: true, room, bed })}
                onDeleteBed={(bed) =>
                  setConfirm({
                    open: true,
                    type: 'deleteBed',
                    title: 'Delete Bed',
                    message: `Delete bed ${bed.bed_number} from room ${room.room_number}? Occupied or reserved beds cannot be deleted.`,
                    confirmLabel: 'Delete',
                    payload: bed,
                  })
                }
                onChangeStatus={(bed) => setStatusForm({ open: true, bed })}
                onAssign={(bed) => setAssignForm({ open: true, bed })}
                onRelease={(bed) =>
                  setConfirm({
                    open: true,
                    type: 'release',
                    title: 'Release Bed',
                    message: `Release bed ${bed.bed_number}? The bed will become available.`,
                    confirmLabel: 'Release',
                    payload: bed,
                  })
                }
              />
            ))}
          </div>

          {pagination.total_pages > 1 && (
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm sm:px-6">
              <p className="text-sm text-muted">
                Page {page} of {pagination.total_pages}
              </p>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!pagination.has_previous || loading}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!pagination.has_next || loading}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {canManage && (
        <>
          <RoomFormModal
            open={roomForm.open}
            room={roomForm.room}
            submitting={submitting}
            onClose={() => !submitting && setRoomForm({ open: false, room: null })}
            onSubmit={handleRoomSubmit}
          />
          <BedFormModal
            open={bedForm.open}
            bed={bedForm.bed}
            room={bedForm.room}
            submitting={submitting}
            onClose={() => !submitting && setBedForm({ open: false, room: null, bed: null })}
            onSubmit={handleBedSubmit}
          />
          <ChangeStatusModal
            open={statusForm.open}
            bed={statusForm.bed}
            submitting={submitting}
            onClose={() => !submitting && setStatusForm({ open: false, bed: null })}
            onSubmit={handleStatusSubmit}
          />
        </>
      )}

      <AssignBedModal
        open={assignForm.open}
        bed={assignForm.bed}
        submitting={submitting}
        onClose={() => !submitting && setAssignForm({ open: false, bed: null })}
        onAssign={handleAssign}
      />

      <RoomDetailModal
        open={detail.open}
        room={detail.room}
        beds={detail.beds}
        bed={detail.bed}
        patientsById={patientsById}
        onClose={() => setDetail({ open: false, room: null, beds: [], bed: null })}
      />

      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        confirmLabel={confirm.confirmLabel}
        variant={confirm.type === 'release' ? 'primary' : 'danger'}
        loading={submitting}
        onConfirm={handleConfirm}
        onCancel={closeConfirm}
      />
    </div>
  )
}

export function AdminBedsPage() {
  return (
    <BedManagementPage
      canManage
      title="Beds Management"
      subtitle="Manage rooms, beds, occupancy, and availability."
    />
  )
}

export function ReceptionBedsPage() {
  return (
    <BedManagementPage
      title="Bed Availability"
      subtitle="View rooms and assign or release patient beds."
    />
  )
}
