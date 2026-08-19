import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  // 1. Récupérer tous les items avec une DLC
  const { data: items } = await supabase.from('items').select('*').not('date_peremption', 'is', null)
  
  // 2. Récupérer l'annuaire des topics des utilisateurs
  const { data: settings } = await supabase.from('user_settings').select('*')
  const settingsMap = new Map(settings?.map(s => [s.user_id, s.ntfy_topic]))

  if (!items) return NextResponse.json({ success: true, message: 'Rien à traiter' })

  const today = new Date()
  
  // 3. Regrouper les alertes par utilisateur
  const alertesParUser: Record<string, string[]> = {}

  items.forEach(item => {
    const dlc = new Date(item.date_peremption!)
    const diffDays = Math.ceil((dlc.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays >= 0 && diffDays <= 7) {
      if (!alertesParUser[item.user_id]) alertesParUser[item.user_id] = []
      alertesParUser[item.user_id].push(item.produit)
    }
  })

  // 4. Envoyer les notifs personnalisées
  for (const [userId, produits] of Object.entries(alertesParUser)) {
    const topic = settingsMap.get(userId)
    if (topic) {
      await fetch(`https://ntfy.sh/${topic}`, {
        method: 'POST',
        body: `${produits.length} produit(s) à consommer : ${produits.join(', ')}`,
        headers: { 'Title': 'Alertes Frosti', 'Tags': 'warning,ice_cube' }
      })
    }
  }

  return NextResponse.json({ success: true, users_notifies: Object.keys(alertesParUser) })
}