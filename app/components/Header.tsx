'use client'

import { useEffect, useState } from 'react'

export default function Header() {
  const [userName, setUserName] = useState<string>('')

  useEffect(() => {
    // Lecture simple du cookie côté client
    const value = `; ${document.cookie}`
    const parts = value.split(`; congelo_user_id=`)
    if (parts.length === 2) {
      setUserName(parts.pop()?.split(';').shift() || '')
    }
  }, [])

  if (!userName) return null // Ne s'affiche pas si non connecté

  return (
    <header className="bg-white shadow-sm border-b border-slate-200 px-4 py-3 mb-6 sticky top-0 z-40 flex justify-between items-center rounded-b-2xl">
      <div className="font-bold text-sky-500 tracking-wide">❄️ Frosti</div>
      <div className="text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
        Connecté : <span className="font-bold text-slate-700">{userName}</span>
      </div>
    </header>
  )
}