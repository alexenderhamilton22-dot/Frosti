import type { Metadata } from "next";
import "./globals.css";
import Navbar from "./components/Navbar";


import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Frosti",
  description: "La gestion de mes congélos et frigos",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Frosti",
  },
};

export const viewport: Viewport = {
  themeColor: "#0ea5e9", // La couleur bleue de Frosti pour la barre du haut sur téléphone
};



export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="bg-slate-50 min-h-screen text-slate-800 antialiased">
        <Navbar />
        <main className="max-w-4xl mx-auto p-4 sm:p-6">
          {children}
        </main>
      </body>
    </html>
  );
}