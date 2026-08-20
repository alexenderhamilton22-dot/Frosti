'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../supabase/client'
import Footer from '../components/Footer'

const FREEZER_COLORS = [
  'bg-emerald-500 text-white shadow-emerald-500/30',
  'bg-amber-500 text-white shadow-amber-500/30',
  'bg-sky-500 text-white shadow-sky-500/30',
  'bg-rose-500 text-white shadow-rose-500/30',
  'bg-violet-600 text-white shadow-violet-600/30',
  'bg-indigo-500 text-white shadow-indigo-500/30'
]

const FRIDGE_COLORS = [
  'bg-cyan-500 text-white shadow-cyan-500/30',
  'bg-lime-500 text-white shadow-lime-500/30',
  'bg-fuchsia-500 text-white shadow-fuchsia-500/30',
  'bg-yellow-500 text-white shadow-yellow-500/30',
  'bg-teal-500 text-white shadow-teal-500/30',
  'bg-pink-500 text-white shadow-pink-500/30'
]

interface Equipment { id: string; name: string; is_fridge: boolean }
interface Item {
  id: string; user_id: string; congelo_id: string; categorie: string; produit: string;
  qte: number; unite: string; date_entree: string; date_peremption: string | null; notes: string | null
}
interface AlertRule { fridge: number; freezer: number }

export default function AlertsPage() {
  const [items, setItems] = useState<Item[]>([])
  const [equipments, setEquipments] = useState<Equipment[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [rules, setRules] = useState<Record<string, AlertRule>>({})
  const [ntfyInput, setNtfyInput] = useState('')
  const [isSavingRules, setIsSavingRules] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  
  const supabase = createClient()

  function getCookie(name: string) {
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) return parts.pop()?.split(';').shift()
    return localStorage.getItem(name)
  }

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const userId = getCookie('congelo_user_id')

    // 1. Charger les équipements
    let fQuery = supabase.from('freezers').select('*').order('created_at', { ascending: true })
    if (userId) fQuery = fQuery.eq('user_id', userId)
    const { data: fData } = await fQuery
    if (fData) setEquipments(fData)

    // 2. Charger les items
    let query = supabase.from('items').select('*').order('date_peremption', { ascending: true })
    if (userId) query = query.eq('user_id', userId)
    const { data: iData } = await query
    if (iData) setItems(iData)

    // 3. Charger toutes les catégories disponibles
    const { data: cData } = await supabase.from('categories').select('name').order('name')
    let allCats: string[] = []
    if (cData) allCats = cData.map(c => c.name)
    // Au cas où des items ont des catégories supprimées, on les rajoute
    if (iData) {
      const itemCats = Array.from(new Set(iData.map(i => i.categorie)))
      allCats = Array.from(new Set([...allCats, ...itemCats]))
    }
    setCategories(allCats)

    // 4. Charger les réglages Ntfy et les Règles
    if (userId) {
      const { data: sData, error: sError } = await supabase.from('user_settings').select('ntfy_topic').eq('user_id', userId)
      if (sData && sData.length > 0 && sData[0].ntfy_topic) {
        setNtfyInput(sData[0].ntfy_topic)
      }

      setDebugInfo({
        userId,
        rawCookie: document.cookie,
        rawLocalStorage: typeof window !== 'undefined' ? localStorage.getItem('congelo_user_id') : null,
        sData,
        sError: sError ? sError.message : null,
      })

      const { data: rData, error: rError } = await supabase.from('alert_rules').select('*').eq('user_id', userId)
      if (!rError && rData) {
        const loadedRules: Record<string, AlertRule> = {}
        rData.forEach(r => {
          loadedRules[r.categorie] = { fridge: r.fridge_days, freezer: r.freezer_days }
        })
        setRules(loadedRules)
      }
    } else {
      setDebugInfo({
        userId: null,
        rawCookie: document.cookie,
        rawLocalStorage: typeof window !== 'undefined' ? localStorage.getItem('congelo_user_id') : null,
        sData: null,
        sError: 'userId absent — la requête user_settings n\'a même pas été lancée',
      })
    }
  }

  const handleRuleChange = (cat: string, type: 'fridge' | 'freezer', value: number) => {
    setRules(prev => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        fridge: type === 'fridge' ? value : (prev[cat]?.fridge ?? 7),
        freezer: type === 'freezer' ? value : (prev[cat]?.freezer ?? 90)
      }
    }))
  }

  async function saveAlertRules() {
    setIsSavingRules(true)
    const userId = getCookie('congelo_user_id')
    if (!userId) { alert("Utilisateur non identifié."); setIsSavingRules(false); return }

    const upsertData = categories.map(cat => ({
      user_id: userId,
      categorie: cat,
      fridge_days: rules[cat]?.fridge ?? 7,
      freezer_days: rules[cat]?.freezer ?? 90
    }))

    const { error } = await supabase.from('alert_rules').upsert(upsertData, { onConflict: 'user_id, categorie' })
    setIsSavingRules(false)

    if (!error) alert("Règles d'alertes sauvegardées avec succès !")
    else alert("Erreur lors de la sauvegarde : " + error.message)
    
    loadData()
  }

  async function saveNtfyTopic() {
    const userId = getCookie('congelo_user_id')
    if (!userId) { alert("Utilisateur non identifié."); return }

    const { error } = await supabase.from('user_settings').upsert({ user_id: userId, ntfy_topic: ntfyInput })
    if (!error) alert(`Canal "${ntfyInput}" enregistré !`)
    else alert("Erreur Supabase : " + error.message)
  }

  async function updateQty(id: string, delta: number) {
    const item = items.find(i => String(i.id) === String(id))
    if (!item) return
    const newQty = Math.max(0, item.qte + delta)
    if (newQty === 0) {
      if (confirm('Quantité à 0 — Supprimer ce produit ?')) await supabase.from('items').delete().eq('id', id)
      else return
    } else {
      await supabase.from('items').update({ qte: newQty }).eq('id', id)
    }
    loadData()
  }

  async function deleteItem(id: string) { await supabase.from('items').delete().eq('id', id); loadData() }

  const today = new Date().toISOString().slice(0, 10)
  
  const freezers = equipments.filter(e => !e.is_fridge)
  const fridges = equipments.filter(e => e.is_fridge)

  // 🔴 Périmés = date_peremption dépassée par rapport à aujourd'hui
  const expiredItems = items.filter(i => i.date_peremption && i.date_peremption < today)
  
  // 🟠 Alertes personnalisées
  const warningItems = items.filter(i => {
    // Si déjà périmé, il est dans expiredItems, on l'ignore ici
    if (i.date_peremption && i.date_peremption < today) return false
    
    const eq = equipments.find(e => String(e.id) === String(i.congelo_id))
    const isFridge = eq?.is_fridge
    
    // Récupération de la règle (ou valeur par défaut 7 / 90)
    const rule = rules[i.categorie] || { fridge: 7, freezer: 90 }
    const threshold = isFridge ? rule.fridge : rule.freezer

    if (i.date_peremption) {
      // Alerte basée sur la DLC (ex: il reste 5 jours et le seuil est à 7)
      const diffTime = new Date(i.date_peremption).getTime() - new Date(today).getTime()
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return daysLeft <= threshold
    } else {
      // Alerte basée sur l'âge (Date d'entrée) si aucune DLC (ex: dans le congélo depuis 95 jours pour un seuil à 90)
      const diffTime = new Date(today).getTime() - new Date(i.date_entree).getTime()
      const ageDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      return ageDays >= threshold
    }
  })

  return (
    <div className="space-y-6 pb-20">

      {/* 🐛 BANDEAU DE DEBUG TEMPORAIRE — à retirer une fois le bug résolu */}
      {debugInfo && (
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-2xl p-4 text-xs font-mono text-slate-800 break-all">
          <p className="font-bold text-yellow-700 mb-2">🐛 DEBUG (à retirer après diagnostic)</p>
          <p><span className="font-bold">userId détecté :</span> {debugInfo.userId ?? '(vide/null)'}</p>
          <p><span className="font-bold">document.cookie brut :</span> {debugInfo.rawCookie || '(vide)'}</p>
          <p><span className="font-bold">localStorage congelo_user_id :</span> {debugInfo.rawLocalStorage ?? '(vide/null)'}</p>
          <p><span className="font-bold">Résultat Supabase (sData) :</span> {JSON.stringify(debugInfo.sData)}</p>
          <p><span className="font-bold">Erreur Supabase (sError) :</span> {debugInfo.sError ?? '(aucune)'}</p>
        </div>
      )}

      {/* SECTION NTFY */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h1 className="text-xl font-bold mb-4 text-slate-800">Alertes & Notifications ⚠️</h1>
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Mon canal Ntfy :</label>
          <div className="flex gap-2">
            <input type="text" placeholder="ex: frosti_alertes_famille" value={ntfyInput} onChange={e => setNtfyInput(e.target.value)} className="p-2 bg-white border border-slate-200 rounded-lg flex-1 text-sm outline-none focus:border-sky-500" />
            <button onClick={saveNtfyTopic} className="bg-sky-500 text-white px-4 rounded-lg font-bold text-sm hover:bg-sky-600 transition">OK</button>
          </div>
        </div>
      </div>

      {/* SECTION REGLAGES DES SEUILS */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Mes seuils d'alerte personnalisés</h2>
          <button onClick={saveAlertRules} disabled={isSavingRules} className="bg-teal-500 hover:bg-teal-600 text-white text-xs px-4 py-2 rounded-lg font-bold transition shadow-sm disabled:opacity-50">
            {isSavingRules ? '⏳...' : '💾 Sauvegarder'}
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Délai avant DLC, ou durée de présence si pas de DLC. Par défaut : <span className="font-bold text-sky-500">7j</span> au frigo, <span className="font-bold text-sky-500">90j</span> au congélo.
        </p>

        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
          {categories.length > 0 ? categories.map(cat => (
            <div key={cat} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl gap-3">
              <span className="text-sm font-bold text-slate-700 min-w-[120px]">{cat}</span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🧊</span>
                  <input 
                    type="number" min="1" 
                    value={rules[cat]?.fridge ?? 7} 
                    onChange={e => handleRuleChange(cat, 'fridge', Number(e.target.value))} 
                    className="w-16 p-1.5 text-center text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-sky-500" 
                    title="Jours au frigo"
                  />
                  <span className="text-xs text-slate-400 font-medium">j</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">❄️</span>
                  <input 
                    type="number" min="1" 
                    value={rules[cat]?.freezer ?? 90} 
                    onChange={e => handleRuleChange(cat, 'freezer', Number(e.target.value))} 
                    className="w-16 p-1.5 text-center text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-sky-500" 
                    title="Jours au congélo"
                  />
                  <span className="text-xs text-slate-400 font-medium">j</span>
                </div>
              </div>
            </div>
          )) : (
            <p className="text-xs text-slate-400 italic">Aucune catégorie trouvée.</p>
          )}
        </div>
      </div>

      {/* AFFICHAGE DES ALERTES */}
      {[
        { title: '🔴 Produits périmés', items: expiredItems, color: 'border-red-200' },
        { title: '🟠 Attention requise (Selon vos seuils)', items: warningItems, color: 'border-amber-200' }
      ].map(group => (
        <div key={group.title} className="space-y-3">
          <h2 className="font-bold text-sm uppercase tracking-wider text-slate-700">{group.title} ({group.items.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {group.items.length > 0 ? (
              group.items.map(item => {
                const eq = equipments.find(e => String(e.id) === String(item.congelo_id))
                const isFridge = eq?.is_fridge
                
                let colorClass = 'bg-slate-600 text-white'
                if (eq) {
                  if (isFridge) {
                    const fIndex = fridges.findIndex(f => String(f.id) === String(eq.id))
                    colorClass = FRIDGE_COLORS[fIndex % FRIDGE_COLORS.length]
                  } else {
                    const fIndex = freezers.findIndex(f => String(f.id) === String(eq.id))
                    colorClass = FREEZER_COLORS[fIndex % FREEZER_COLORS.length]
                  }
                }

                return (
                  <div key={item.id} className={`bg-white p-4 rounded-2xl border ${group.color} shadow-sm flex flex-col justify-between`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-slate-800 text-base">{item.produit}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] uppercase tracking-wider text-sky-600 font-semibold">{item.categorie}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${colorClass}`}>
                            {isFridge ? '🧊' : '❄️'} {eq?.name || 'Espace'}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => deleteItem(item.id)} className="text-slate-300 hover:text-red-500 text-base font-bold px-2" title="Supprimer ce produit">🗑️</button>
                    </div>

                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-50">
                      <div className="flex items-center space-x-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                        <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 bg-white rounded-lg shadow-sm font-bold text-slate-700">-</button>
                        <span className="text-sm font-bold px-2 text-slate-800 min-w-[60px] text-center">{item.qte} {item.unite}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 bg-white rounded-lg shadow-sm font-bold text-slate-700">+</button>
                      </div>
                      <div className="text-right text-[11px] text-slate-400">
                        {item.date_peremption ? <span className="font-semibold text-amber-600 block">DLC : {item.date_peremption}</span> : <span className="font-semibold text-slate-600 block">Entré le {item.date_entree}</span>}
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="col-span-full text-slate-400 text-sm italic bg-white p-4 rounded-2xl border border-slate-100">Aucun produit ne requiert votre attention.</p>
            )}
          </div>
        </div>
      ))}
      <Footer />
    </div>
  )
}