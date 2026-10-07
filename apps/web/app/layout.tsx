import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Gochi_Hand } from "next/font/google";
import { RegisterSW } from "@/pwa/RegisterSW";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });
const gochi = Gochi_Hand({ subsets: ["latin"], weight: "400", variable: "--font-gochi", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Brain Arena · IEDC", template: "%s · Brain Arena" },
  description: "Live logic-game tournaments for IEDC events. Works fully offline on the event Wi-Fi.",
  applicationName: "Brain Arena",
  appleWebApp: { capable: true, title: "Brain Arena", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#fffbf2",
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
