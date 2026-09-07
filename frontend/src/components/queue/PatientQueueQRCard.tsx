import { useNavigate } from 'react-router-dom'
import QRCode from 'react-qr-code'
import { Button } from '@/components/ui'
import { ROUTES } from '@/utils/constants'
import { getPublicQueueUrl } from '@/utils/publicUrl'

export function PatientQueueQRCard() {
  const navigate = useNavigate()
  const queueUrl = getPublicQueueUrl()

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <div className="flex flex-1 flex-col">
        <h3 className="text-lg font-semibold text-foreground">Patient Queue QR</h3>
        <p className="mt-2 text-sm text-muted">
          Scan to view today&apos;s live queue and token status.
        </p>

        <a
          href={queueUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-auto mt-6 block rounded-xl p-3 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          aria-label="Open public patient queue page"
          title={queueUrl}
        >
          <QRCode
            value={queueUrl}
            size={160}
            level="M"
            bgColor="#FFFFFF"
            fgColor="#0F172A"
            className="h-auto w-full max-w-[160px] sm:max-w-[180px]"
          />
        </a>

        <div className="mt-4 flex justify-center">
          <Button type="button" onClick={() => navigate(ROUTES.QUEUE)}>
            Open Queue
          </Button>
        </div>
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-xl bg-primary-50 px-4 py-3">
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-primary-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M12 18h.01M8.25 21.75h7.5A2.25 2.25 0 0018 19.5V4.5A2.25 2.25 0 0015.75 2.25h-7.5A2.25 2.25 0 006 4.5v15a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
        <p className="text-sm text-primary-800">
          Patients can scan this QR code to check their token status and current queue.
        </p>
      </div>
    </div>
  )
}
