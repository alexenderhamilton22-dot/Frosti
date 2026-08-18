'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()

  // Si on est sur la page de login, on n'affiche pas la barre de navigation
  if (pathname === '/login') return null

  const links = [
    { href: '/', label: 'Congélateurs ❄️' },
    { href: '/alerts', label: 'Alertes ⚠️' },
    { href: '/search', label: 'Recherche 🔍' },
  ]

  const handleLogout = () => {
    // Supprimer les cookies de session
    document.cookie = 'congelo_user_id=; path=/; max-age=0'
    document.cookie = 'congelo_username=; path=/; max-age=0'
    router.push('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 flex justify-between items-center h-16">
        {/* Logo et Nom Frosti */}
        <Link href="/" className="flex items-center space-x-2">
          <img src="/logo.png" alt="Frosti Logo" className="w-10 h-10 rounded-xl object-cover shadow-sm" />
          <div>
            <span className="font-bold text-xl text-slate-800 tracking-tight">Frosti</span>
            <span className="block text-[10px] text-slate-400 font-medium -mt-1">Ma gestion de congélos</span>
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
                className={`px-3 py-2 rounded-xl text-sm font-medium transition ${
                  isActive 
                    ? 'bg-sky-50 text-sky-600' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {link.label}
              </Link>
            )
          })}

          <button
            onClick={handleLogout}
            title="Se déconnecter"
            className="ml-2 px-3 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition"
          >
            Déconnexion 🚪
          </button>
        </div>
      </div>
    </nav>
  )
}