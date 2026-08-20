import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "./components/Navbar"; 

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
        {/* On ne garde que la Navbar qui s'occupe de tout (navigation, profil, déconnexion) */}
        <Navbar />
        
        <main className="max-w-4xl mx-auto p-2 sm:p-4">
          {children}
        </main>
      </body>
    </html>
  );
}