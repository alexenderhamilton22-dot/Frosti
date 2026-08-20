'use client'

import { useEffect, useState } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'

interface BarcodeScannerProps {
  onProductFound: (name: string, category: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onProductFound, onClose }: BarcodeScannerProps) {
  const [error, setError] = useState<string>('')
  const [isScanning, setIsScanning] = useState(true)

  useEffect(() => {
    // Configuration du scanner
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 150 } },
      false
    )

    // Fonction déclenchée quand un code-barres est lu
    async function onScanSuccess(decodedText: string) {
      if (!isScanning) return
      setIsScanning(false) // On met en pause pour ne pas scanner 10 fois de suite
      scanner.clear() // On ferme la caméra

      try {
        // 🌍 Appel à l'API publique et gratuite d'Open Food Facts
        const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${decodedText}.json`, {
          headers: { 'User-Agent': 'FrostiApp - Personal Inventory - Web' }
        })
        const data = await response.json()

        if (data.status === 1) {
          // Produit trouvé ! On récupère le nom (en français en priorité)
          const productName = data.product.product_name_fr || data.product.product_name || "Produit inconnu"
          
          // On tente de déduire une catégorie simple
          let category = "Divers"
          const categoriesText = (data.product.categories || "").toLowerCase()
          if (categoriesText.includes("viande") || categoriesText.includes("meat")) category = "Viande"
          else if (categoriesText.includes("légume") || categoriesText.includes("vegetable")) category = "Légumes"
          else if (categoriesText.includes("poisson") || categoriesText.includes("fish")) category = "Poisson"
          else if (categoriesText.includes("glace") || categoriesText.includes("ice cream")) category = "Desserts"

          onProductFound(productName, category)
        } else {
          setError("Produit introuvable dans la base Open Food Facts.")
          setTimeout(() => onClose(), 3000)
        }
      } catch (err) {
        setError("Erreur de connexion à la base de données.")
        setTimeout(() => onClose(), 3000)
      }
    }

    function onScanFailure(error: any) {
      // Html5Qrcode déclenche beaucoup d'erreurs "silencieuses" en cherchant un code, on les ignore
    }

    scanner.render(onScanSuccess, onScanFailure)

    // Nettoyage de la caméra si on ferme le composant
    return () => {
      scanner.clear().catch(e => console.error("Erreur nettoyage caméra", e))
    }
  }, [isScanning, onProductFound, onClose])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4">
      <div className="bg-white p-4 rounded-2xl max-w-md w-full relative">
        <button 
          onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 bg-red-500 text-white rounded-full font-bold shadow-md"
        >
          ×
        </button>
        <h3 className="text-center font-bold text-slate-800 mb-4">Scanner un code-barres 📷</h3>
        
        {/* C'est ici que la caméra va s'afficher */}
        <div id="reader" className="w-full rounded-xl overflow-hidden"></div>
        
        {error && (
          <p className="mt-4 text-sm text-red-500 bg-red-50 p-2 rounded-lg text-center font-medium">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}