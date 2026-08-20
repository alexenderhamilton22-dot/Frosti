import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  // Connexion côté serveur (nécessite le Service Role Key ou Anon Key)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 1. Récupération de toutes les données nécessaires en parallèle pour aller vite
  const [
    { data: items },
    { data: freezers },
    { data: rules },
    { data: settings }
  ] = await Promise.all([
    supabase.from('items').select('*'),
    supabase.from('freezers').select('id, is_fridge'),
    supabase.from('alert_rules').select('*'),
    supabase.from('user_settings').select('*')
  ])

  if (!items || items.length === 0) {
    return NextResponse.json({ success: true, message: "Aucun produit en base." })
  }

  // 2. Préparation des dictionnaires pour des recherches instantanées
  const eqMap = new Map(freezers?.map(f => [String(f.id), f.is_fridge]))
  const ruleMap = new Map(rules?.map(r => [`${r.user_id}_${r.categorie}`, { fridge: r.fridge_days, freezer: r.freezer_days }]))
  const settingsMap = new Map(settings?.map(s => [s.user_id, s.ntfy_topic]))

  const today = new Date().toISOString().slice(0, 10)
  const todayTime = new Date(today).getTime()

  // On va stocker la liste des alertes par utilisateur
  const alertesParUser: Record<string, string[]> = {}

  // 3. Analyse de chaque produit
  items.forEach(item => {
    const isFridge = eqMap.get(String(item.congelo_id)) ?? false
    const userRule = ruleMap.get(`${item.user_id}_${item.categorie}`)
    
    // Application du seuil (règle personnalisée OU règle par défaut)
    const threshold = isFridge ? (userRule?.fridge ?? 7) : (userRule?.freezer ?? 90)

    let requiresAttention = false

    if (item.date_peremption) {
      // Cas A : Le produit a une DLC
      const dlcTime = new Date(item.date_peremption).getTime()
      const daysLeft = Math.ceil((dlcTime - todayTime) / (1000 * 60 * 60 * 24))
      if (daysLeft <= threshold) {
        requiresAttention = true
      }
    } else if (item.date_entree) {
      // Cas B : Pas de DLC, calcul selon l'ancienneté (Date d'entrée)
      const entreeTime = new Date(item.date_entree).getTime()
      const ageDays = Math.floor((todayTime - entreeTime) / (1000 * 60 * 60 * 24))
      if (ageDays >= threshold) {
        requiresAttention = true
      }
    }

    if (requiresAttention) {
      if (!alertesParUser[item.user_id]) alertesParUser[item.user_id] = []
      alertesParUser[item.user_id].push(`${item.produit} (${item.categorie})`)
    }
  })

  let envois = 0

  // 4. Envoi des notifications via Ntfy
  for (const [userId, produits] of Object.entries(alertesParUser)) {
    const topic = settingsMap.get(userId)
    
    if (topic) {
      // Si on a plus de 10 produits en alerte, on tronque la liste pour que la notification reste lisible
      const listText = produits.slice(0, 10).join(', ') + (produits.length > 10 ? `... et ${produits.length - 10} autres` : '')
      
      await fetch(`https://ntfy.sh/${topic}`, {
        method: 'POST',
        body: `${produits.length} produit(s) requièrent votre attention : ${listText}`,
        headers: { 
          'Title': 'Frosti - Alertes Stocks ', 
          'Tags': 'warning,ice_cube' 
        }
      })
      envois++
    }
  }

  return NextResponse.json({ 
    success: true, 
    users_notifies: Object.keys(alertesParUser).length, 
    notifications_envoyees: envois 
  })
}