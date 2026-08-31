import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div
      role="status"
      className="relative z-[60] bg-amber-500 px-3 py-2 text-center text-sm font-medium text-white"
    >
      You are offline. Some data may be unavailable until you reconnect.
    </div>
  )
}
