import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "./components/Navbar"; // <-- C'est ce qui manquait !

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Frosti",
  description: "Ma gestion de congélos et frigos",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Frosti",
  },
};

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${inter.className} bg-slate-50 text-slate-900 min-h-screen`}>
        {/* On remet la barre de navigation en haut de toutes les pages */}
        <Navbar />
        {/* On centre le contenu de l'application */}
        <main className="max-w-4xl mx-auto p-2 sm:p-4">
          {children}
        </main>
      </body>
    </html>
  );
}