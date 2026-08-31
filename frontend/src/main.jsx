import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppProvider, AuthProvider, NotificationProvider, ToastProvider } from '@/context'
import { registerPwa } from '@/pwa/registerPwa'
import App from './App.jsx'
import './index.css'

registerPwa()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <NotificationProvider>
            <AppProvider>
              <App />
            </AppProvider>
          </NotificationProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
