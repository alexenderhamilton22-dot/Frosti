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

export default function SearchPage() {
  const [items, setItems] = useState<Item[]>([])
  const [freezers, setFreezers] = useState<Freezer[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCat, setSelectedCat] = useState('')
  const [selectedCongelo, setSelectedCongelo] = useState('')

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

    let query = supabase.from('items').select('*').order('created_at', { ascending: false })
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

  const categories = Array.from(new Set(items.map(i => i.categorie)))

  const filteredItems = items.filter(i => {
    if (selectedCongelo && i.congelo_id !== selectedCongelo) return false
    if (selectedCat && i.categorie !== selectedCat) return false
    if (searchQuery && !i.produit.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h1 className="text-xl font-bold mb-1 text-slate-800">Recherche globale 🔍</h1>
        <p className="text-slate-400 text-sm mb-4">Trouvez un produit dans l'ensemble de vos congélateurs en un clin d'œil.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Rechercher par nom..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-sky-500 text-slate-800"
          />

          <select
            value={selectedCongelo}
            onChange={e => setSelectedCongelo(e.target.value)}
            className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-sky-500 text-slate-800"
          >
            <option value="">Tous les congélateurs</option>
            {freezers.map(f => <option key={f.id} value={f.id}>❄️ {f.name}</option>)}
          </select>

          <select
            value={selectedCat}
            onChange={e => setSelectedCat(e.target.value)}
            className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-sky-500 text-slate-800"
          >
            <option value="">Toutes les catégories</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredItems.length > 0 ? (
          filteredItems.map(item => {
            const freezer = freezers.find(f => f.id === item.congelo_id)
            const freezerName = freezer?.name || 'Congélateur'

            return (
              <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                <div>
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
                    <button onClick={() => deleteItem(item.id)} className="text-slate-300 hover:text-red-500 text-lg font-bold px-2">
                      ×
                    </button>
                  </div>

                  {item.notes && <p className="text-xs text-slate-400 italic mt-1">Note : {item.notes}</p>}
                </div>

                <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-50">
                  <div className="flex items-center space-x-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                    <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 bg-white rounded-lg shadow-sm font-bold text-slate-700 hover:bg-sky-50 hover:text-sky-600 flex items-center justify-center transition">
                      -
                    </button>
                    <span className="text-sm font-bold px-2 text-slate-800 min-w-[60px] text-center">
                      {item.qte} {item.unite}
                    </span>
                    <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 bg-white rounded-lg shadow-sm font-bold text-slate-700 hover:bg-sky-50 hover:text-sky-600 flex items-center justify-center transition">
                      +
                    </button>
                  </div>

                  <div className="text-right text-[11px] text-slate-400">
                    {item.date_peremption ? (
                      <span className="font-semibold text-amber-600 block">DLC : {item.date_peremption}</span>
                    ) : (
                      <span>Entré le {item.date_entree}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
            <span className="text-4xl">🔍</span>
            <p className="text-slate-400 text-sm mt-2">Aucun produit ne correspond à votre recherche.</p>
          </div>
        )}
      </div>
    </div>
  )
}