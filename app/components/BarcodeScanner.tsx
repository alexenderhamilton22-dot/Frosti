'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface BarcodeScannerProps {
  onProductFound: (name: string, category: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onProductFound, onClose }: BarcodeScannerProps) {
  const [error, setError] = useState<string>('')
  const [status, setStatus] = useState<'starting' | 'scanning' | 'stopped'>('starting')
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
  const isScanning = useRef(true)
  const mountedRef = useRef(true)
  const startPromiseRef = useRef<Promise<any> | null>(null)

  useEffect(() => {
    mountedRef.current = true
    isScanning.current = true

    async function startScanner() {
      // 1. Contexte sécurisé obligatoire pour la caméra (https ou localhost)
      if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        setError("La caméra nécessite une connexion sécurisée (HTTPS). Ouvre le site en https:// ou teste sur localhost.")
        return
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Ton navigateur ne supporte pas l'accès à la caméra.")
        return
      }

      const readerElement = document.getElementById('reader')
      if (!readerElement) return

      const html5QrCode = new Html5Qrcode('reader')
      html5QrCodeRef.current = html5QrCode

      async function onScanSuccess(decodedText: string) {
        if (!isScanning.current) return
        isScanning.current = false

        try {
          if (html5QrCodeRef.current) {
            await html5QrCodeRef.current.stop()
          }
        } catch (e) { console.error(e) }

        try {
          const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${decodedText}.json`, {
            headers: { 'User-Agent': 'FrostiApp - Personal Inventory - Web' }
          })
          const data = await response.json()

          if (data.status === 1) {
            const productName = data.product.product_name_fr || data.product.product_name || "Produit inconnu"

            let category = "Divers"
            const categoriesText = (data.product.categories || "").toLowerCase()
            if (categoriesText.includes("viande") || categoriesText.includes("meat")) category = "Viande"
            else if (categoriesText.includes("légume") || categoriesText.includes("vegetable")) category = "Légumes"
            else if (categoriesText.includes("poisson") || categoriesText.includes("fish")) category = "Poisson"
            else if (categoriesText.includes("glace") || categoriesText.includes("ice cream")) category = "Desserts"

            onProductFound(productName, category)
          } else {
            setError("Produit introuvable dans la base.")
            setTimeout(() => onClose(), 3000)
          }
        } catch (err) {
          setError("Erreur de connexion.")
          setTimeout(() => onClose(), 3000)
        }
      }

      function onScanFailure() {
        // On ignore les erreurs de "recherche en cours"
      }

      try {
        // Demande explicite de la permission caméra + démarrage direct du flux
        const startPromise = html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          onScanSuccess,
          onScanFailure
        )
        startPromiseRef.current = startPromise
        await startPromise
        if (mountedRef.current) setStatus('scanning')
      } catch (err: any) {
        console.error('Erreur démarrage caméra', err)
        if (!mountedRef.current) return
        const msg = String(err?.message || err)
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('notallowed')) {
          setError("Accès à la caméra refusé. Vérifie les autorisations du site dans les réglages de ton navigateur (icône 🔒 à côté de l'URL).")
        } else if (msg.toLowerCase().includes('notfound')) {
          setError("Aucune caméra détectée sur cet appareil.")
        } else {
          setError("Impossible de démarrer la caméra : " + msg)
        }
      }
    }

    startScanner()

    return () => {
      mountedRef.current = false
      isScanning.current = false
      const instance = html5QrCodeRef.current
      html5QrCodeRef.current = null
      if (!instance) return

      // On attend que start() ait fini de s'installer (ou échoué) avant de
      // toucher au scanner : appeler stop() trop tôt fait planter l'app
      // (React Strict Mode monte/démonte le composant une fois en dev).
      const pending = startPromiseRef.current || Promise.resolve()
      pending.catch(() => {}).finally(() => {
        try {
          // Html5QrcodeScannerState: NOT_STARTED=1, SCANNING=2, PAUSED=3
          const state = (instance as any).getState?.()
          if (state === 2 || state === 3) {
            instance.stop()
              .catch(() => {})
              .finally(() => { try { instance.clear() } catch {} })
          } else {
            try { instance.clear() } catch {}
          }
        } catch (e) {
          console.error('Erreur nettoyage scanner', e)
        }
      })
    }
  }, [onProductFound, onClose])

  // Styles en dur (indépendants de Tailwind) pour garantir l'affichage
  // même si les classes utilitaires ne sont pas compilées pour ce fichier.
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 999999,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.9)',
    padding: '1rem',
  }
  const cardStyle: React.CSSProperties = {
    background: 'white',
    padding: '1rem',
    borderRadius: '1rem',
    maxWidth: '28rem',
    width: '100%',
    position: 'relative',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
  }

  return (
    <div style={overlayStyle} className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4">
      <div style={cardStyle} className="bg-white p-4 rounded-2xl max-w-md w-full relative shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          style={{ position: 'absolute', top: '-0.75rem', right: '-0.75rem', width: '2.5rem', height: '2.5rem', background: '#ef4444', color: 'white', borderRadius: '9999px', fontWeight: 'bold', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', zIndex: 10 }}
          className="absolute -top-3 -right-3 w-10 h-10 bg-red-500 text-white rounded-full font-bold shadow-lg border-2 border-white flex items-center justify-center text-xl z-10"
        >
          ✕
        </button>
        <h3 className="text-center font-bold text-slate-800 mb-4">Scanner un produit 📷</h3>

        {!error && status === 'starting' && (
          <p className="text-center text-sm text-slate-500 mb-2">Demande d'accès à la caméra en cours…</p>
        )}

        {/* La div où la caméra va s'injecter */}
        <div id="reader" style={{ width: '100%', borderRadius: '0.75rem', overflow: 'hidden', background: '#f1f5f9', minHeight: '250px' }} className="w-full rounded-xl overflow-hidden bg-slate-100 min-h-[250px]"></div>

        {error && (
          <p className="mt-4 text-sm text-red-500 bg-red-50 p-3 rounded-lg text-center font-medium border border-red-100">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
