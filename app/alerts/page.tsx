'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../supabase/client'

// Palette contrastée par nom de congélateur
const getFreezerStyle = (name: string) => {
  if (name.includes('Maison')) return 'bg-emerald-500 text-white shadow-emerald-500/30' // Vert
  if (name.includes('Longère')) return 'bg-amber-500 text-white shadow-amber-500/30'    // Orange
  if (name.includes('Cellier')) return 'bg-rose-500 text-white shadow-rose-500/30'     // Rose
  if (name.includes('Cave')) return 'bg-violet-600 text-white shadow-violet-600/30'    // Violet
  return 'bg-slate-600 text-white shadow-slate-600/30'                                 // Gris par défaut
}

interface Freezer {
  id: string
  name: string
}

interface Item {
  id: string
  congelo_id: string
  categorie: string
  produit: string
  qte: number
  unite: string
  date_entree: string
  date_peremption: string | null
  notes: string | null
}

export default function AlertsPage() {
  const [items, setItems] = useState<Item[]>([])
  const [freezers, setFreezers] = useState<Freezer[]>([])
  const supabase = createClient()

  function getCookie(name: string) {
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) return parts.pop()?.split(';').shift()
  }

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const userId = getCookie('congelo_user_id')

    const { data: fData } = await supabase.from('freezers').select('*').eq('user_id', userId)
    if (fData) setFreezers(fData)

    let query = supabase.from('items').select('*').order('date_peremption', { ascending: true })
    if (userId) query = query.eq('user_id', userId)
    const { data: iData } = await query
    if (iData) setItems(iData)
  }

  async function updateQty(id: string, delta: number) {
    const item = items.find(i => i.id === id)
    if (!item) return
    const newQty = Math.max(0, item.qte + delta)

    if (newQty === 0) {
      if (confirm('Quantité à 0 — Supprimer ce produit ?')) {
        await supabase.from('items').delete().eq('id', id)
      } else {
        return
      }
    } else {
      await supabase.from('items').update({ qte: newQty }).eq('id', id)
    }
    loadData()
  }

  async function deleteItem(id: string) {
    await supabase.from('items').delete().eq('id', id)
    loadData()
  }

  const today = new Date().toISOString().slice(0, 10)

  const expiredItems = items.filter(i => i.date_peremption && i.date_peremption < today)
  const warningItems = items.filter(i => {
    if (!i.date_peremption) return false
    if (i.date_peremption < today) return false
    const diffTime = new Date(i.date_peremption).getTime() - new Date(today).getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays <= 30
  })

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h1 className="text-xl font-bold mb-1 text-slate-800">Alertes & Péremptions ⚠️</h1>
        <p className="text-slate-400 text-sm">Suivez les dates limites de consommation (DLC) de vos congélateurs.</p>
      </div>

      <div className="space-y-3">
        <h2 className="font-bold text-red-600 flex items-center gap-2 text-sm uppercase tracking-wider">
          <span>🔴 Produits périmés ({expiredItems.length})</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {expiredItems.length > 0 ? (
            expiredItems.map(item => {
              const freezerName = freezers.find(f => f.id === item.congelo_id)?.name || 'Congélateur'
              return (
                <div key={item.id} className="bg-white p-4 rounded-2xl border border-red-200 shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-800 text-base">{item.produit}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] uppercase tracking-wider text-sky-600 font-semibold">{item.categorie}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${getFreezerStyle(freezerName)}`}>
                          ❄️ {freezerName}
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
                    <span className="font-bold text-red-600 text-xs bg-red-50 px-2 py-1 rounded-lg">Expiré le {item.date_peremption}</span>
                  </div>
                </div>
              )
            })
          ) : (
            <p className="text-slate-400 text-sm italic bg-white p-4 rounded-2xl border border-slate-100">Aucun produit périmé.</p>
          )}
        </div>
      </div>

      <div className="space-y-3 pt-4">
        <h2 className="font-bold text-amber-600 flex items-center gap-2 text-sm uppercase tracking-wider">
          <span>🟠 DLC proche (moins de 30 jours) ({warningItems.length})</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {warningItems.length > 0 ? (
            warningItems.map(item => {
              const freezerName = freezers.find(f => f.id === item.congelo_id)?.name || 'Congélateur'
              return (
                <div key={item.id} className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-800 text-base">{item.produit}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] uppercase tracking-wider text-sky-600 font-semibold">{item.categorie}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${getFreezerStyle(freezerName)}`}>
                          ❄️ {freezerName}
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
                    <span className="font-semibold text-amber-600 text-xs bg-amber-50 px-2 py-1 rounded-lg">DLC : {item.date_peremption}</span>
                  </div>
                </div>
              )
            })
          ) : (
            <p className="text-slate-400 text-sm italic bg-white p-4 rounded-2xl border border-slate-100">Aucune alerte à court terme.</p>
          )}
        </div>
      </div>
    </div>
  )
}