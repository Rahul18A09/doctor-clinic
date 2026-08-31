import { InstallPrompt } from '@/components/pwa/InstallPrompt'
import { OfflineBanner } from '@/components/pwa/OfflineBanner'
import { AppRoutes } from '@/routes'

function App() {
  return (
    <>
      <OfflineBanner />
      <InstallPrompt />
      <AppRoutes />
    </>
  )
}

export default App
