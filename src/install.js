import { useEffect, useState } from 'react'

// Chrome/Edge/Samsung fire `beforeinstallprompt` once, often before React mounts,
// so capture it at import time and let components subscribe.
let deferredPrompt = null
const listeners = new Set()
const notify = () => listeners.forEach((fn) => fn())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
  )
}

export function detectPlatform() {
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const inApp = /FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)/i.test(ua)
  if (ios) return /CriOS|FxiOS|EdgiOS/i.test(ua) ? 'ios-other' : inApp ? 'in-app' : 'ios-safari'
  if (inApp) return 'in-app'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

export function useInstall() {
  const [, force] = useState(0)
  useEffect(() => {
    const fn = () => force((n) => n + 1)
    listeners.add(fn)
    return () => listeners.delete(fn)
  }, [])

  return {
    installed: isStandalone(),
    canPrompt: !!deferredPrompt,
    async prompt() {
      if (!deferredPrompt) return false
      const e = deferredPrompt
      deferredPrompt = null
      notify()
      await e.prompt()
      const { outcome } = await e.userChoice
      return outcome === 'accepted'
    },
  }
}
