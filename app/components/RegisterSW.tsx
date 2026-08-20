'use client'

import { useEffect } from 'react'

// À placer une seule fois dans le layout racine (app/layout.tsx),
// à l'intérieur du <body>, par exemple : <RegisterSW />
export default function RegisterSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.error('Échec enregistrement Service Worker :', err))
    }
  }, [])

  return null
}
