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
  id: string; congelo_id: string; categorie: string; produit: string;
  qte: number; unite: string; date_entree: string; date_peremption: string | null; notes: string | null
}

export default function SearchPage() {
  const [items, setItems] = useState<Item[]>([])
  const [equipments, setEquipments] = useState<Equipment[]>([])
  
  // États pour la recherche classique
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCat, setSelectedCat] = useState('')
  const [selectedEq, setSelectedEq] = useState('')

  // États pour les plages de dates
  const [dateEntreeStart, setDateEntreeStart] = useState('')
  const [dateEntreeEnd, setDateEntreeEnd] = useState('')
  const [dlcStart, setDlcStart] = useState('')
  const [dlcEnd, setDlcEnd] = useState('')

  const supabase = createClient()

  function getCookie(name: string) {
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) return parts.pop()?.split(';').shift()
  }

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const userId = getCookie('congelo_user_id')

    let fQuery = supabase.from('freezers').select('*').order('created_at', { ascending: true })
    if (userId) fQuery = fQuery.eq('user_id', userId)
    const { data: fData } = await fQuery
    if (fData) setEquipments(fData)

    let query = supabase.from('items').select('*').order('created_at', { ascending: false })
    if (userId) query = query.eq('user_id', userId)
    const { data: iData } = await query
    if (iData) setItems(iData)
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

  const categories = Array.from(new Set(items.map(i => i.categorie)))
  const freezers = equipments.filter(e => !e.is_fridge)
  const fridges = equipments.filter(e => e.is_fridge)

  const filteredItems = items.filter(i => {
    // Filtres classiques
    if (selectedEq && String(i.congelo_id) !== String(selectedEq)) return false
    if (selectedCat && i.categorie !== selectedCat) return false
    if (searchQuery && !i.produit.toLowerCase().includes(searchQuery.toLowerCase())) return false

    // Filtres sur la Date d'entrée
    if (dateEntreeStart && i.date_entree < dateEntreeStart) return false
    if (dateEntreeEnd && i.date_entree > dateEntreeEnd) return false

    // Filtres sur la DLC
    if (dlcStart || dlcEnd) {
      // Si on filtre par DLC mais que le produit n'a pas de DLC, on l'exclut
      if (!i.date_peremption) return false
      if (dlcStart && i.date_peremption < dlcStart) return false
      if (dlcEnd && i.date_peremption > dlcEnd) return false
    }

    return true
  })

  // Fonction pour réinitialiser tous les filtres
  function resetFilters() {
    setSearchQuery('')
    setSelectedCat('')
    setSelectedEq('')
    setDateEntreeStart('')
    setDateEntreeEnd('')
    setDlcStart('')
    setDlcEnd('')
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-xl font-bold mb-1 text-slate-800">Recherche & Filtres 🔍</h1>
            <p className="text-slate-400 text-sm">Trouvez un produit en combinant plusieurs critères.</p>
          </div>
          <button onClick={resetFilters} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2 px-3 rounded-lg transition">
            Réinitialiser
          </button>
        </div>

        {/* Champs de recherche de base */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <input type="text" placeholder="Rechercher par nom..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-sky-500 text-slate-800" />
          <select value={selectedEq} onChange={e => setSelectedEq(e.target.value)} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-sky-500 text-slate-800">
            <option value="">Tous les espaces</option>
            {freezers.length > 0 && <optgroup label="Congélateurs">{freezers.map(f => <option key={f.id} value={f.id}>❄️ {f.name}</option>)}</optgroup>}
            {fridges.length > 0 && <optgroup label="Frigos">{fridges.map(f => <option key={f.id} value={f.id}>🧊 {f.name}</option>)}</optgroup>}
          </select>
          <select value={selectedCat} onChange={e => setSelectedCat(e.target.value)} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-sky-500 text-slate-800">
            <option value="">Toutes les catégories</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>

        {/* Nouveaux champs : Recherche par périodes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Date d'entrée (Période)</label>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Du</span>
              <input type="date" value={dateEntreeStart} onChange={e => setDateEntreeStart(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-sky-500 text-slate-800" />
              <span className="text-xs text-slate-400 font-medium">au</span>
              <input type="date" value={dateEntreeEnd} onChange={e => setDateEntreeEnd(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-sky-500 text-slate-800" />
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <label className="text-xs font-bold text-slate-500 uppercase block mb-2">DLC (Période)</label>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Du</span>
              <input type="date" value={dlcStart} onChange={e => setDlcStart(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-sky-500 text-slate-800" />
              <span className="text-xs text-slate-400 font-medium">au</span>
              <input type="date" value={dlcEnd} onChange={e => setDlcEnd(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-sky-500 text-slate-800" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredItems.length > 0 ? (
          filteredItems.map(item => {
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
            const eqName = eq ? eq.name : 'Inconnu'
            const eqIcon = isFridge ? '🧊' : '❄️'

            return (
              <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-800 text-base">{item.produit}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] uppercase tracking-wider text-sky-600 font-semibold">{item.categorie}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${colorClass}`}>{eqIcon} {eqName}</span>
                      </div>
                    </div>
                    <button onClick={() => deleteItem(item.id)} className="text-slate-300 hover:text-red-500 text-base font-bold px-2" title="Supprimer ce produit">🗑️</button>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-50">
                  <div className="flex items-center space-x-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                    <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 bg-white rounded-lg shadow-sm font-bold text-slate-700 hover:bg-sky-50 hover:text-sky-600">-</button>
                    <span className="text-sm font-bold px-2 text-slate-800 min-w-[60px] text-center">{item.qte} {item.unite}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 bg-white rounded-lg shadow-sm font-bold text-slate-700 hover:bg-sky-50 hover:text-sky-600">+</button>
                  </div>
                  <div className="text-right text-[11px] text-slate-400">
                    {item.date_peremption ? <span className="font-semibold text-amber-600 block">DLC : {item.date_peremption}</span> : <span>Entré le {item.date_entree}</span>}
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
            <span className="text-4xl">🔍</span>
            <p className="text-slate-400 text-sm mt-2">Aucun produit ne correspond à vos filtres.</p>
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}