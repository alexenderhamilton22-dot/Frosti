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

export default function AlertsPage() {
  const [items, setItems] = useState<Item[]>([])
  const [equipments, setEquipments] = useState<Equipment[]>([])
  const [alertDays, setAlertDays] = useState<number>(30)
  const [ntfyInput, setNtfyInput] = useState('')
  const supabase = createClient()

  function getCookie(name: string) {
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) return parts.pop()?.split(';').shift()
  }

  useEffect(() => {
    const savedDays = localStorage.getItem('frosti_alert_days')
    if (savedDays) setAlertDays(parseInt(savedDays, 10))
    loadData()
  }, [])

  async function loadData() {
    const userId = getCookie('congelo_user_id')
    let fQuery = supabase.from('freezers').select('*').order('created_at', { ascending: true })
    if (userId) fQuery = fQuery.eq('user_id', userId)
    const { data: fData } = await fQuery
    if (fData) setEquipments(fData)

    let query = supabase.from('items').select('*').order('date_peremption', { ascending: true })
    if (userId) query = query.eq('user_id', userId)
    const { data: iData } = await query
    if (iData) setItems(iData)
  }

  const handleAlertDaysChange = (days: number) => {
    setAlertDays(days)
    localStorage.setItem('frosti_alert_days', days.toString())
  }

  async function saveNtfyTopic() {
    const userId = getCookie('congelo_user_id')
    const { error } = await supabase.from('user_settings').upsert({ user_id: userId, ntfy_topic: ntfyInput })
    if (!error) alert("Canal Ntfy enregistré !")
    else alert("Erreur lors de l'enregistrement.")
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
  
  // DÉFINITION DES VARIABLES QUI MANQUAIENT :
  const freezers = equipments.filter(e => !e.is_fridge)
  const fridges = equipments.filter(e => e.is_fridge)

  const expiredItems = items.filter(i => i.date_peremption && i.date_peremption < today)
  const warningItems = items.filter(i => {
    if (!i.date_peremption || i.date_peremption < today) return false
    const diffTime = new Date(i.date_peremption).getTime() - new Date(today).getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) <= alertDays
  })

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h1 className="text-xl font-bold mb-4 text-slate-800">Alertes & Péremptions ⚠️</h1>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex-1">
            <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Alerte avant (jours) :</label>
            <input type="number" min="1" value={alertDays} onChange={e => handleAlertDaysChange(Number(e.target.value))} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-amber-600 outline-none" />
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex-1">
            <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Mon canal Ntfy :</label>
            <div className="flex gap-2">
              <input type="text" placeholder="ex: mon_canal_secret" value={ntfyInput} onChange={e => setNtfyInput(e.target.value)} className="p-2 border rounded-lg flex-1 text-sm outline-none" />
              <button onClick={saveNtfyTopic} className="bg-sky-500 text-white px-4 rounded-lg font-bold text-sm">OK</button>
            </div>
          </div>
        </div>
      </div>

      {[
        { title: '🔴 Produits périmés', items: expiredItems, color: 'border-red-200' },
        { title: '🟠 DLC proche', items: warningItems, color: 'border-amber-200' }
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
                      <button onClick={() => deleteItem(item.id)} className="text-slate-300 hover:text-red-500 text-lg font-bold px-2">×</button>
                    </div>

                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-50">
                      <div className="flex items-center space-x-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                        <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 bg-white rounded-lg shadow-sm font-bold text-slate-700">-</button>
                        <span className="text-sm font-bold px-2 text-slate-800 min-w-[60px] text-center">{item.qte} {item.unite}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 bg-white rounded-lg shadow-sm font-bold text-slate-700">+</button>
                      </div>
                      <span className="font-semibold text-xs bg-slate-50 px-2 py-1 rounded-lg text-amber-600">DLC : {item.date_peremption}</span>
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="col-span-full text-slate-400 text-sm italic bg-white p-4 rounded-2xl border border-slate-100">Aucun produit dans cette catégorie.</p>
            )}
          </div>
        </div>
      ))}
      <Footer />
    </div>
  )
}