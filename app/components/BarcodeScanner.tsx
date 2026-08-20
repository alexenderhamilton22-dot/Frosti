'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'

interface BarcodeScannerProps {
  onProductFound: (name: string, category: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onProductFound, onClose }: BarcodeScannerProps) {
  const [error, setError] = useState<string>('')
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  const isScanning = useRef(true)

  useEffect(() => {
    // Si le scanner existe déjà, on ne le recrée pas (évite le bug React 18)
    if (scannerRef.current) return

    // On s'assure que la div "reader" est bien dans la page avant de lancer la caméra
    const readerElement = document.getElementById("reader")
    if (!readerElement) return

    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 150 } },
      false
    )
    scannerRef.current = scanner

    async function onScanSuccess(decodedText: string) {
      if (!isScanning.current) return
      isScanning.current = false // Bloque les scans multiples
      
      try {
        if (scannerRef.current) {
          await scannerRef.current.clear()
        }
      } catch(e) { console.error(e) }

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

    function onScanFailure(error: any) {
      // On ignore les erreurs de "recherche en cours"
    }

    scanner.render(onScanSuccess, onScanFailure)

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => console.error("Erreur nettoyage", e))
        scannerRef.current = null
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