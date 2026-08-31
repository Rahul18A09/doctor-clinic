/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __VITE_LAN_IP__: string
declare const __VITE_HTTPS__: boolean

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_URL?: string
  readonly VITE_DEV_PUBLIC_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.jsx' {
  import type { ComponentType } from 'react'
  const component: ComponentType<Record<string, unknown>>
  export default component
}

declare module '@/components/dashboard/StatCard' {
  import type { ComponentType, ReactNode } from 'react'

  export const StatCard: ComponentType<{
    title: string
    value: string
    icon?: ReactNode
    trend?: string
    color?: string
    watermark?: boolean
    variant?: 'today' | 'waiting' | 'consultation' | 'completed'
  }>
}

declare module '@/components/ui' {
  import type { ComponentType, ButtonHTMLAttributes, ReactNode } from 'react'

  export const Button: ComponentType<
    ButtonHTMLAttributes<HTMLButtonElement> & {
      children?: ReactNode
      variant?: string
    }
  >

  export const RefreshButton: ComponentType<{
    onClick?: () => void | Promise<void>
    loading?: boolean
    label?: string
    className?: string
  }>
  export function getAppliedSearchFromInput(
    searchInput: string,
    appliedSearch: string,
    page: number,
  ): { nextSearch: string; searchChanged: boolean; nextPage: number }
}

declare module '@/utils/constants' {
  export const API_BASE_URL: string
  export const CLINIC_NAME: string
  export const ROUTES: {
    HOME: string
    LOGIN: string
    QUEUE: string
    [key: string]: string
  }
}

declare module '@/utils/publicUrl' {
  export function getPublicAppOrigin(): string
  export function getPublicQueueUrl(): string
}

declare module '@/utils/errors' {
  export function getApiErrorMessage(error: unknown, fallback?: string): string
}

declare module '@/utils/formatToken' {
  export function formatTokenForUi(token: string | null | undefined): string
}

declare module '*.svg' {
  const src: string
  export default src
}

declare module 'virtual:pwa-register' {
  export function registerSW(options?: {
    immediate?: boolean
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
  }): (reloadPage?: boolean) => Promise<void>
}
