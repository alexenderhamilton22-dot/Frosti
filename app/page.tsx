'use client'

import { useState, useEffect } from 'react'
import { createClient } from './supabase/client'
import Footer from './components/Footer'

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
interface Category { id: string; name: string }
interface ProductTemplate { id: string; name: string }
interface Item {
  id: string; congelo_id: string; categorie: string; produit: string;
  qte: number; unite: string; date_entree: string; date_peremption: string | null; notes: string | null
}

export default function HomePage() {
  const [equipments, setEquipments] = useState<Equipment[]>([])
  const [activeEqId, setActiveEqId] = useState<string>('')
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<ProductTemplate[]>([])
  const [items, setItems] = useState<Item[]>([])
  
  const [filterCat, setFilterCat] = useState('')
  const [searchTxt, setSearchTxt] = useState('')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  
  const [selectedCat, setSelectedCat] = useState('')
  const [newCatInput, setNewCatInput] = useState('')
  const [isCreatingCat, setIsCreatingCat] = useState(false)

  const [selectedProd, setSelectedProd] = useState('')
  const [newProdInput, setNewProdInput] = useState('')
  const [isCreatingProd, setIsCreatingProd] = useState(false)

  const [qty, setQty] = useState(1)
  const [unit, setUnit] = useState('pièce(s)')
  const [dateEntree, setDateEntree] = useState(new Date().toISOString().slice(0, 10))
  const [datePeremption, setDatePeremption] = useState('')
  const [notes, setNotes] = useState('')
  
  const [newEqName, setNewEqName] = useState('')
  const [newEqIsFridge, setNewEqIsFridge] = useState(false)

  const supabase = createClient()

  function getCookie(name: string) {
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) return parts.pop()?.split(';').shift()
  }

  useEffect(() => { loadInitialData() }, [])

  async function loadInitialData() {
    const userId = getCookie('congelo_user_id')

    let query = supabase.from('freezers').select('*').order('created_at', { ascending: true })
    if (userId) query = query.eq('user_id', userId)

    const { data: fData } = await query
    if (fData && fData.length > 0) {
      setEquipments(fData)
      setActiveEqId(String(fData[0].id))
    }

    const { data: cData } = await supabase.from('categories').select('*').order('name')
    if (cData && cData.length > 0) {
      setCategories(cData)
      setSelectedCat(cData[0].name)
      loadProductsForCategory(cData[0].name)
    }
    loadItems()
  }

async function loadProductsForCategory(catName: string) {
    const { data } = await supabase.from('product_templates').select('*, categories!inner(name)').eq('categories.name', catName)
    if (data) {
      setProducts(data)
      if (data.length > 0) {
        setSelectedProd(data[0].name)
        setIsCreatingProd(false) // Il y a des produits, on affiche la liste
      } else {
        setSelectedProd('')
        setIsCreatingProd(true) // C'est vide, on ouvre le champ de création directement !
      }
    }
  }

  async function loadItems() {
    const userId = getCookie('congelo_user_id')
    let query = supabase.from('items').select('*').order('created_at', { ascending: false })
    if (userId) query = query.eq('user_id', userId)
    const { data } = await query
    if (data) setItems(data)
  }

const handleCategoryChange = (val: string) => {
    if (val === '__NEW_CAT__') { 
      setIsCreatingCat(true)
      setSelectedCat('')
      // On force la création du produit et on vide l'ancienne liste
      setProducts([])
      setIsCreatingProd(true)
      setSelectedProd('')
    } 
    else { 
      setIsCreatingCat(false)
      setSelectedCat(val)
      loadProductsForCategory(val) 
    }
  }

  const handleProductChange = (val: string) => {
    if (val === '__NEW_PROD__') { setIsCreatingProd(true); setSelectedProd('') } 
    else { setIsCreatingProd(false); setSelectedProd(val) }
  }

  async function handleAddEq(e: React.FormEvent) {
    e.preventDefault()
    if (!newEqName.trim()) return
    const userId = getCookie('congelo_user_id')
    const { data, error } = await supabase.from('freezers').insert([{ name: newEqName.trim(), user_id: userId, is_fridge: newEqIsFridge }]).select()
    if (!error && data) {
      setEquipments([...equipments, data[0]])
      setActiveEqId(String(data[0].id))
      setNewEqName('')
    }
  }

  // Nouvelle fonction pour supprimer un équipement
  async function handleDeleteEq(eqId: string, eqName: string, e: React.MouseEvent) {
    e.stopPropagation() // Empêche de déclencher la sélection de l'équipement
    
    // Vérifier s'il y a des produits dans cet équipement
    const itemsInEq = items.filter(i => String(i.congelo_id) === String(eqId))
    
    if (itemsInEq.length > 0) {
      if (!confirm(`⚠️ Attention ! L'équipement "${eqName}" contient encore ${itemsInEq.length} produit(s).\n\nÊtes-vous sûr de vouloir supprimer cet équipement ainsi que tout son contenu ?`)) {
        return
      }
      // Supprimer manuellement les produits pour éviter une erreur de clé étrangère
      await supabase.from('items').delete().eq('congelo_id', eqId)
    } else {
      if (!confirm(`Voulez-vous vraiment supprimer l'équipement "${eqName}" ?`)) return
    }

    // Supprimer l'équipement
    const { error } = await supabase.from('freezers').delete().eq('id', eqId)
    if (!error) {
      const newEqs = equipments.filter(eq => String(eq.id) !== String(eqId))
      setEquipments(newEqs)
      if (String(activeEqId) === String(eqId)) {
        setActiveEqId(newEqs.length > 0 ? String(newEqs[0].id) : '')
      }
      loadItems() // Recharger les items pour mettre à jour l'affichage
    } else {
      alert("Erreur lors de la suppression de l'équipement : " + error.message)
    }
  }

  function openAddModal() {
    setEditingItemId(null); setIsCreatingCat(false); setIsCreatingProd(false);
    if (categories.length > 0) { setSelectedCat(categories[0].name); loadProductsForCategory(categories[0].name) }
    setQty(1); setUnit('pièce(s)'); setDateEntree(new Date().toISOString().slice(0, 10)); setDatePeremption(''); setNotes(''); setIsModalOpen(true)
  }

  function openEditModal(item: Item) {
    setEditingItemId(item.id); setSelectedCat(item.categorie); setIsCreatingCat(false);
    loadProductsForCategory(item.categorie).then(() => { setSelectedProd(item.produit) })
    setQty(item.qte); setUnit(item.unite || 'pièce(s)'); setDateEntree(item.date_entree || new Date().toISOString().slice(0, 10)); setDatePeremption(item.date_peremption || ''); setNotes(item.notes || ''); setIsModalOpen(true)
  }


function openDuplicateModal(item: Item) {
    // La seule différence avec l'édition : on met l'ID à null pour créer un NOUVEAU produit
    setEditingItemId(null); 
    setSelectedCat(item.categorie); 
    setIsCreatingCat(false);
    
    loadProductsForCategory(item.categorie).then(() => { 
      setSelectedProd(item.produit) 
    });
    
    setQty(item.qte); 
    setUnit(item.unite || 'pièce(s)'); 
    setDateEntree(item.date_entree || new Date().toISOString().slice(0, 10)); 
    setDatePeremption(item.date_peremption || ''); 
    setNotes(item.notes || ''); 
    setIsModalOpen(true);
  }


async function handleSaveItem(e: React.FormEvent) {
    e.preventDefault()
    let finalCat = selectedCat
    if (isCreatingCat && newCatInput.trim()) {
      finalCat = newCatInput.trim()
      await supabase.from('categories').insert([{ name: finalCat }]).select()
      const { data: cData } = await supabase.from('categories').select('*').order('name')
      if (cData) setCategories(cData)
    }
    
    let finalProd = selectedProd
    if (isCreatingProd && newProdInput.trim()) {
      finalProd = newProdInput.trim()
      
      // On cherche l'ID de la catégorie
      let catObj = categories.find(c => c.name === finalCat)
      let realCatId = catObj?.id
      
      // Si la catégorie vient d'être créée, on va chercher son ID tout neuf dans la base
      if (!realCatId) {
         const { data: freshCat } = await supabase.from('categories').select('id').eq('name', finalCat).single()
         realCatId = freshCat?.id
      }
      
      if (realCatId) {
        await supabase.from('product_templates').insert([{ category_id: realCatId, name: finalProd }])
      }
    }
    if (!finalProd) return

    const userId = getCookie('congelo_user_id')
    const targetEq = activeEqId || (equipments[0] ? String(equipments[0].id) : null)
    if (!targetEq) { alert('Veuillez créer un espace de stockage.'); return }

    if (editingItemId) {
      const { error } = await supabase.from('items').update({ categorie: finalCat, produit: finalProd, qte: qty, unite: unit, date_entree: dateEntree, date_peremption: datePeremption || null, notes: notes.trim() || null }).eq('id', editingItemId)
      if (!error) { setIsModalOpen(false); loadItems() }
    } else {
      const { error } = await supabase.from('items').insert([{ user_id: userId, congelo_id: targetEq, categorie: finalCat, produit: finalProd, qte: qty, unite: unit, date_entree: dateEntree, date_peremption: datePeremption || null, notes: notes.trim() || null }])
      if (!error) { setIsModalOpen(false); loadItems() }
    }
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
    loadItems()
  }

  async function deleteItem(id: string) { await supabase.from('items').delete().eq('id', id); loadItems() }

const filteredItems = items.filter(i => {
    if (activeEqId && String(i.congelo_id) !== String(activeEqId)) return false
    if (filterCat && i.categorie !== filterCat) return false
    
    if (searchTxt) {
      const searchLower = searchTxt.toLowerCase()
      const matchProduit = i.produit.toLowerCase().includes(searchLower)
      const matchNote = i.notes ? i.notes.toLowerCase().includes(searchLower) : false
      
      // Si le texte n'est ni dans le produit, ni dans la note, on masque l'élément
      if (!matchProduit && !matchNote) return false
    }
    
    return true
  })

  const freezers = equipments.filter(e => !e.is_fridge)
  const fridges = equipments.filter(e => e.is_fridge)

  return (
    <div className="space-y-6 pb-20">
      <section className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Mes espaces de stockage</h2>
        
        {/* Congélateurs */}
        {freezers.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-2">
              {freezers.map((f, index) => {
                const isActive = String(activeEqId) === String(f.id)
                const colorClass = FREEZER_COLORS[index % FREEZER_COLORS.length]
                return (
                  <div key={f.id} className={`flex items-center rounded-xl transition shadow-sm ${isActive ? `${colorClass} ring-4 ring-offset-2 ring-slate-200 scale-105` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    <button onClick={() => setActiveEqId(String(f.id))} className="px-3 py-2.5 text-sm font-bold flex-1 text-left">
                      ❄️ {f.name}
                    </button>
                    <button onClick={(e) => handleDeleteEq(String(f.id), f.name, e)} className="pr-3 pl-1 py-2.5 text-sm opacity-60 hover:opacity-100 hover:text-red-500 transition-opacity" title="Supprimer cet équipement">
                      🗑️
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Frigos */}
        {fridges.length > 0 && (
          <div className="mb-4 pt-3 border-t border-slate-50">
            <div className="flex flex-wrap gap-2">
              {fridges.map((f, index) => {
                const isActive = String(activeEqId) === String(f.id)
                const colorClass = FRIDGE_COLORS[index % FRIDGE_COLORS.length]
                return (
                  <div key={f.id} className={`flex items-center rounded-xl transition shadow-sm ${isActive ? `${colorClass} ring-4 ring-offset-2 ring-slate-200 scale-105` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    <button onClick={() => setActiveEqId(String(f.id))} className="px-3 py-2.5 text-sm font-bold flex-1 text-left">
                      🧊 {f.name}
                    </button>
                    <button onClick={(e) => handleDeleteEq(String(f.id), f.name, e)} className="pr-3 pl-1 py-2.5 text-sm opacity-60 hover:opacity-100 hover:text-red-500 transition-opacity" title="Supprimer cet équipement">
                      🗑️
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Formulaire d'ajout d'équipement */}
        <form onSubmit={handleAddEq} className="pt-3 border-t border-slate-100 space-y-2">
          <div className="flex gap-4 items-center mb-2 px-1">
            <label className="text-sm text-slate-600 font-medium flex items-center gap-1 cursor-pointer">
              <input type="radio" name="eqType" checked={!newEqIsFridge} onChange={() => setNewEqIsFridge(false)} className="accent-sky-500" />
              ❄️ Congélateur
            </label>
            <label className="text-sm text-slate-600 font-medium flex items-center gap-1 cursor-pointer">
              <input type="radio" name="eqType" checked={newEqIsFridge} onChange={() => setNewEqIsFridge(true)} className="accent-sky-500" />
              🧊 Frigo
            </label>
          </div>
          <div className="flex gap-2">
            <input type="text" placeholder={newEqIsFridge ? "Nouveau frigo..." : "Nouveau congélateur..."} value={newEqName} onChange={e => setNewEqName(e.target.value)} className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-sky-500 text-slate-800" />
            <button type="submit" className="px-4 py-2 bg-sky-500 text-white text-sm font-semibold rounded-xl hover:bg-sky-600 transition">+ Ajouter</button>
          </div>
        </form>
      </section>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <button onClick={openAddModal} className="w-full sm:w-auto bg-teal-500 hover:bg-teal-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-teal-500/20 transition flex items-center justify-center gap-2 text-base">
          <span>+ Ajouter un produit</span>
        </button>

        <div className="flex flex-col sm:flex-row gap-2 flex-1 w-full sm:max-w-md">
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none flex-1">
            <option value="">Toutes les catégories</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <input type="text" placeholder="Rechercher..." value={searchTxt} onChange={e => setSearchTxt(e.target.value)} className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none flex-1" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredItems.length > 0 ? (
          filteredItems.map(item => {
            // Trouver l'équipement et définir la bonne couleur/icône
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
                    <div className="flex items-center gap-1">
                      <button onClick={() => openDuplicateModal(item)} className="text-xs text-slate-400 hover:text-teal-600 font-semibold px-2 py-1 bg-slate-50 rounded-lg border border-slate-100" title="Dupliquer ce produit">Copier 📋</button>
                      <button onClick={() => openEditModal(item)} className="text-xs text-slate-400 hover:text-sky-600 font-semibold px-2 py-1 bg-slate-50 rounded-lg border border-slate-100">Éditer ✏️</button>
                      <button onClick={() => deleteItem(item.id)} className="text-slate-300 hover:text-red-500 text-base font-bold px-2" title="Supprimer ce produit">🗑️</button>
                    </div>
                  </div>
                  {item.notes && <p className="text-xs text-slate-400 italic mt-1">Note : {item.notes}</p>}
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
            <span className="text-4xl">🧺</span>
            <p className="text-slate-400 text-sm mt-2">Aucun produit dans cet espace.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-800">{editingItemId ? 'Modifier le produit ✏️' : 'Ajouter un aliment 🛒'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1">✕</button>
            </div>
            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Catégorie</label>
                <select value={isCreatingCat ? '__NEW_CAT__' : selectedCat} onChange={e => handleCategoryChange(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium outline-none focus:border-sky-500">
                  <option value="__NEW_CAT__" className="font-bold text-teal-600">+ Créer une nouvelle catégorie...</option>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              {isCreatingCat && (
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Nom de la nouvelle catégorie</label>
                  <input type="text" placeholder="ex: Glaces maison..." value={newCatInput} onChange={e => setNewCatInput(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium outline-none focus:border-sky-500" required />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Produit</label>
                <select value={isCreatingProd ? '__NEW_PROD__' : selectedProd} onChange={e => handleProductChange(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium outline-none focus:border-sky-500">
                  <option value="__NEW_PROD__" className="font-bold text-teal-600">+ Ajouter un nouveau produit...</option>
                  {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              {isCreatingProd && (
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Nom du nouveau produit</label>
                  <input type="text" placeholder="Nom du produit..." value={newProdInput} onChange={e => setNewProdInput(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium outline-none focus:border-sky-500" required />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Quantité</label>
                  <input type="number" min="1" step="any" value={qty} onChange={e => setQty(Number(e.target.value))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium outline-none focus:border-sky-500" required />
                </div>
<div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Unité</label>
                  <select value={unit} onChange={e => setUnit(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium outline-none focus:border-sky-500">
                    <option>pièce(s)</option>
                    <option>portion(s)</option>
                    <option>tranche(s)</option>
                    <option>sachet(s)</option>
                    <option>boîte(s)</option>
                    <option>barquette(s)</option>
                    <option>Bouteille 25cl</option>
                    <option>Bouteille 33cl</option>
                    <option>Bouteille 75cl</option>
                    <option>kg</option>
                    <option>g</option>
                    <option>L</option>
                    <option>mL</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Date d'entrée</label>
                  <input type="date" value={dateEntree} onChange={e => setDateEntree(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium outline-none focus:border-sky-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">DLC (Optionnel)</label>
                  <input type="date" value={datePeremption} onChange={e => setDatePeremption(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium outline-none focus:border-sky-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Note (Optionnel)</label>
                <input type="text" placeholder="ex: fait maison..." value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium outline-none focus:border-sky-500" />
              </div>
              <div className="pt-2">
                <button type="submit" className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3.5 rounded-2xl shadow-lg transition text-base">
                  {editingItemId ? 'Enregistrer les modifications' : "Valider l'ajout"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <Footer />
    </div>
  )
}