import { Link } from 'react-router-dom'
import receptionPng from '@/assets/reception.png'
import { ROUTES } from '@/utils/constants'

function MdOutlineKeyboardArrowRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
    </svg>
  )
}

export function ReceptionDeskCard() {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <div className="grid flex-1 items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(120px,38%)] sm:gap-5 2xl:gap-6">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-foreground">Reception Desk</h3>
          <p className="mt-2 text-sm text-muted">
            Register new patients or open the patient list to view waiting and completed
            visits.
          </p>
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
            <Link
              to={ROUTES.RECEPTION_PATIENTS_ADD}
              className="inline-flex w-full items-center justify-center gap-0.5 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary-500/25 transition-colors hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:w-auto"
            >
              Register Patient
              <MdOutlineKeyboardArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to={`${ROUTES.RECEPTION_PATIENTS}?filter=waiting`}
              className="inline-flex w-full items-center justify-center gap-0.5 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary-500/25 transition-colors hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:w-auto"
            >
              View Waiting Queue
              <MdOutlineKeyboardArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
        <img
          src={receptionPng}
          alt="Reception desk"
          className="mx-auto hidden h-auto w-full max-w-[180px] object-contain sm:block sm:max-w-[220px] 2xl:max-w-none"
        />
      </div>
    </div>
  )
}
