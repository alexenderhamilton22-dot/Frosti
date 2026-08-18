'use client'

import { useState } from 'react'
import { createClient } from '../supabase/client'
import { useRouter } from 'next/navigation'

export default function AddFreezerPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Récupérer l'ID user depuis le cookie (on simplifie)
    const userId = document.cookie.split('; ').find(row => row.startsWith('congelo_user_id='))?.split('=')[1]

    const { error } = await supabase
      .from('freezers')
      .insert([{ name, description, user_id: userId }])

    if (!error) router.push('/')
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-bold mb-6">Ajouter un congélateur</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input 
          placeholder="Nom (ex: Congélateur Garage)" 
          className="w-full p-2 border rounded"
          value={name} onChange={e => setName(e.target.value)}
        />
        <input 
          placeholder="Description" 
          className="w-full p-2 border rounded"
          value={description} onChange={e => setDescription(e.target.value)}
        />
        <button className="w-full bg-blue-600 text-white py-2 rounded">Créer</button>
      </form>
    </div>
  )
}