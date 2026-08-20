'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [userName, setUserName] = useState<string>('')

  // Récupération du VRAI nom de l'utilisateur au chargement
  useEffect(() => {
    const value = `; ${document.cookie}`
    // On cherche d'abord le cookie 'congelo_username'
    const parts = value.split(`; congelo_username=`)
    
    if (parts.length === 2) {
      const rawName = parts.pop()?.split(';').shift() || ''
      // decodeURIComponent permet d'afficher correctement les espaces et accents
      setUserName(decodeURIComponent(rawName))
    } else {
      // En plan B, si le username n'existe pas, on tente de lire l'ID
      const idParts = value.split(`; congelo_user_id=`)
      if (idParts.length === 2) {
        setUserName(idParts.pop()?.split(';').shift() || 'Inconnu')
      }
    }
  }, [pathname])

  // Si on est sur la page de login, on n'affiche pas la barre
  if (pathname === '/login') return null

  const links = [
    { href: '/', label: 'Congélateurs', icon: '❄️' },
    { href: '/alerts', label: 'Alertes', icon: '⚠️' },
    { href: '/search', label: 'Recherche', icon: '🔍' },
  ]

  const handleLogout = () => {
    document.cookie = 'congelo_user_id=; path=/; max-age=0'
    document.cookie = 'congelo_username=; path=/; max-age=0'
    localStorage.removeItem('congelo_user_id')
    localStorage.removeItem('congelo_username')
    router.push('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 flex justify-between items-center h-16">
        
        {/* Logo et Nom Frosti + Utilisateur connecté */}
        <Link href="/" className="flex items-center space-x-2 shrink-0">
          <img src="/logo.png" alt="Frosti Logo" className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl object-cover shadow-sm" />
          <div>
            <span className="font-bold text-lg sm:text-xl text-slate-800 tracking-tight">Frosti</span>
            {/* Le sous-titre dynamique qui affiche le vrai utilisateur */}
            <span className="block text-[9px] sm:text-[10px] text-sky-600 font-bold -mt-1 truncate max-w-[100px] sm:max-w-[150px]">
              👤 {userName}
            </span>
          </div>
        </Link>

        {/* Liens de navigation et Déconnexion */}
        <div className="flex items-center space-x-1 sm:space-x-3">
          {links.map((link) => {
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center px-3 py-2 rounded-xl text-sm font-medium transition ${
                  isActive ? 'bg-sky-50 text-sky-600' : 'text-slate-600 hover:bg-slate-50'
                }`}
                title={link.label}
              >
                <span className="hidden sm:inline mr-1.5">{link.label}</span>
                <span className="text-base sm:text-sm">{link.icon}</span>
              </Link>
            )
          })}

          <button
            onClick={handleLogout}
            title="Se déconnecter"
            className="flex items-center ml-1 sm:ml-2 px-3 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition"
          >
            <span className="hidden sm:inline mr-1.5">Déconnexion</span>
            <span className="text-base sm:text-sm">🚪</span>
          </button>
        </div>
        
      </div>
    </nav>
  )
}