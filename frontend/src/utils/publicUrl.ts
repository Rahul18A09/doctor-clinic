import { ROUTES } from '@/utils/constants'

declare const __VITE_LAN_IP__: string | undefined
declare const __VITE_HTTPS__: boolean | undefined

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '')
}

function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '0.0.0.0'
  )
}

function publicProtocol(): string {
  if (__VITE_HTTPS__ === true) {
    return 'https:'
  }
  return window.location.protocol || 'http:'
}

function originForHost(hostname: string): string {
  const protocol = publicProtocol()
  const port = window.location.port
  return port ? `${protocol}//${hostname}:${port}` : `${protocol}//${hostname}`
}

/**
 * Public origin used for QR codes / shareable links.
 * Localhost is rewritten to the machine LAN IP so phones can open the URL.
 * When local HTTPS is enabled, the QR always uses https:// (required for PWA).
 */
export function getPublicAppOrigin(): string {
  if (typeof window === 'undefined') {
    return ''
  }

  const configured = stripTrailingSlash(
    String(import.meta.env.VITE_DEV_PUBLIC_URL || ''),
  )
  if (configured) {
    return configured
  }

  const lanIP =
    typeof __VITE_LAN_IP__ === 'string' ? __VITE_LAN_IP__.trim() : ''

  if (isLoopbackHostname(window.location.hostname) && lanIP) {
    return originForHost(lanIP)
  }

  if (__VITE_HTTPS__ === true && window.location.protocol !== 'https:') {
    return originForHost(window.location.hostname)
  }

  return window.location.origin
}

/** Absolute /queue URL for QR encoding (never embeds a token number). */
export function getPublicQueueUrl(): string {
  return `${getPublicAppOrigin()}${ROUTES.QUEUE}`
}
