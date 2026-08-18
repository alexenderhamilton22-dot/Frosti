import type { Metadata } from "next";
import "./globals.css";
import Navbar from "./components/Navbar";

export const metadata: Metadata = {
  title: "Frosti - Ma gestion de congélos",
  description: "Application simple et rapide de gestion de congélateurs familiaux",
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