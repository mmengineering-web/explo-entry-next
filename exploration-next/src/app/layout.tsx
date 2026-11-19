import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geist = localFont({
  src: [
    { path: "../fonts/geist-latin-wght-normal.woff2", weight: "100 900", style: "normal" },
    { path: "../fonts/geist-latin-ext-wght-normal.woff2", weight: "100 900", style: "normal" },
  ],
  variable: "--font-geist",
  display: "swap",
});
const geistMono = localFont({
  src: "../fonts/geist-mono-latin-wght-normal.woff2",
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Explo Entry",
  description: "Input data eksplorasi, offline-first.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};
export const viewport: Viewport = { themeColor: "#c2410c", width: "device-width", initialScale: 1, viewportFit: "cover" };

// Sets theme and density before first paint so there is no flash.
const PRE = `try{var d=document.documentElement,t=localStorage.getItem('exp_theme');if(!t)t=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';d.dataset.theme=t;var n=localStorage.getItem('exp_density');if(n==='compact')d.dataset.density='compact'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: PRE }} /></head>
      <body>{children}</body>
    </html>
  );
}
