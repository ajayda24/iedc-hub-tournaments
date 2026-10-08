import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Gochi_Hand } from "next/font/google";
import { RegisterSW } from "@/pwa/RegisterSW";
import "./globals.css";
import { site } from "@iedc/data/site";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });
const gochi = Gochi_Hand({ subsets: ["latin"], weight: "400", variable: "--font-gochi", display: "swap" });

export const metadata: Metadata = {
  title: { default: site.defaultTitle, template: site.titleTemplate },
  description: site.description,
  applicationName: site.appName,
  appleWebApp: { capable: true, title: site.shortName, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: site.themeColor,
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${gochi.variable}`}>
      <body className="antialiased">
        <div className="relative z-[1]">{children}</div>
        <RegisterSW />
      </body>
    </html>
  );
}
