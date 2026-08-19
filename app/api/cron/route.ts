import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// On se connecte à Supabase directement depuis le serveur
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  // 1. Récupérer tous les produits qui ont une DLC
  const { data: items } = await supabase
    .from('items')
    .select('*')
    .not('date_peremption', 'is', null)

  if (!items || items.length === 0) {
    return NextResponse.json({ message: 'Aucun produit avec DLC' })
  }

  // 2. Isoler les produits qui périment dans 7 jours ou moins, et qui ne sont pas encore périmés
  const today = new Date()
  const alerts = items.filter(item => {
    const dlc = new Date(item.date_peremption!)
    const diffTime = dlc.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    // Alerte si la péremption est entre aujourd'hui (0) et dans 7 jours
    return diffDays >= 0 && diffDays <= 7
  })

  // 3. Envoyer la notification via Ntfy s'il y a des alertes
  if (alerts.length > 0) {
    // ⚠️ METTEZ VOTRE TOPIC SECRET ICI :
    const topic = "frosti_alertes_famille_2278" 
    
    // On crée le texte du message
    const nomsProduits = alerts.map(a => a.produit).join(', ')
    const message = `${alerts.length} produit(s) à consommer rapidement : ${nomsProduits}`

    // On envoie à Ntfy
    await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      body: message,
      headers: {
        'Title': '⚠️ Alertes Frosti',
        'Tags': 'warning,ice_cube'
      }
    })
  }

  return NextResponse.json({ success: true, alertes_envoyees: alerts.length })
}