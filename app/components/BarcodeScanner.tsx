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
        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          onScanSuccess,
          onScanFailure
        )
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
      if (instance) {
        instance.stop().then(() => instance.clear()).catch(() => {
          try { instance.clear() } catch {}
        })
        html5QrCodeRef.current = null
      }
    }
  }, [onProductFound, onClose])

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4">
      <div className="bg-white p-4 rounded-2xl max-w-md w-full relative shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-3 -right-3 w-10 h-10 bg-red-500 text-white rounded-full font-bold shadow-lg border-2 border-white flex items-center justify-center text-xl z-10"
        >
          ✕
        </button>
        <h3 className="text-center font-bold text-slate-800 mb-4">Scanner un produit 📷</h3>

        {!error && status === 'starting' && (
          <p className="text-center text-sm text-slate-500 mb-2">Demande d'accès à la caméra en cours…</p>
        )}

        {/* La div où la caméra va s'injecter */}
        <div id="reader" className="w-full rounded-xl overflow-hidden bg-slate-100 min-h-[250px]"></div>

        {error && (
          <p className="mt-4 text-sm text-red-500 bg-red-50 p-3 rounded-lg text-center font-medium border border-red-100">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
