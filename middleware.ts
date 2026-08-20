import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // On cherche le cookie de connexion
  const userId = request.cookies.get('congelo_user_id')?.value

  // Si aucun cookie n'est trouvé ET qu'on n'est pas déjà sur la page login
  if (!userId && !request.nextUrl.pathname.startsWith('/login')) {
    // On bloque et on renvoie de force vers la page de connexion
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

// On applique ce vigile sur toutes les pages sauf les fichiers techniques (images, etc.)
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}