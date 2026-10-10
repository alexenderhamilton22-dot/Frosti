import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppProvider from "./components/AppProvider";
import Navbar from "./components/Navbar";
import RegisterSW from "./components/RegisterSW";
export const metadata: Metadata = {
  title: "Frosti · Stocks du foyer",
  description: "Vos frigos et congélateurs, simplement.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Frosti", statusBarStyle: "default" },
};
export const viewport: Viewport = {
  themeColor: "#145b52",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <AppProvider>
          <RegisterSW />
          <Navbar />
          <main>{children}</main>
        </AppProvider>
      </body>
    </html>
  );
}
