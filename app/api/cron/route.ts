import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    // Vérification des variables d'environnement
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error("Clés Supabase introuvables dans l'environnement Vercel.")
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    // 1. Récupérer tous les produits qui ont une DLC
    const { data: items, error: dbError } = await supabase
      .from('items')
      .select('*')
      .not('date_peremption', 'is', null)

    if (dbError) {
      throw new Error("Erreur base de données : " + dbError.message)
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ message: 'Aucun produit avec DLC' })
    }

    // 2. Isoler les produits qui périment dans 7 jours ou moins
    const today = new Date()
    const alerts = items.filter(item => {
      if (!item.date_peremption) return false
      const dlc = new Date(item.date_peremption)
      const diffTime = dlc.getTime() - today.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays >= 0 && diffDays <= 7
    })

    // 3. Envoyer la notification via Ntfy
    let ntfyStatus = "Aucune alerte à envoyer"
    if (alerts.length > 0) {
      const topic = "frosti_alertes_famille_8472" // ⚠️ Vérifiez que c'est bien votre topic
      const nomsProduits = alerts.map(a => a.produit).join(', ')
      const message = `${alerts.length} produit(s) à consommer rapidement : ${nomsProduits}`

      const ntfyResponse = await fetch(`https://ntfy.sh/${topic}`, {
        method: 'POST',
        body: message,
        headers: {
          'Title': '⚠️ Alertes Frosti',
          'Tags': 'warning,ice_cube'
        }
      })
      
      if (!ntfyResponse.ok) {
         throw new Error("Erreur Ntfy : " + await ntfyResponse.text())
      }
      ntfyStatus = "Notification envoyée avec succès"
    }

    return NextResponse.json({ 
      success: true, 
      alertes_trouvees: alerts.length,
      statut_ntfy: ntfyStatus,
      produits_concernes: alerts.map(a => a.produit)
    })

  } catch (error: any) {
    // Si ça plante, on affiche la VRAIE erreur à l'écran
    return NextResponse.json({ 
      erreur_fatale: true, 
      message: error.message 
    }, { status: 500 })
  }
}