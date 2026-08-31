import { registerSW } from 'virtual:pwa-register'

export function registerPwa() {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW(true)
    },
  })
}
