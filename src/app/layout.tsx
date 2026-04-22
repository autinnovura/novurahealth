import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Fraunces } from "next/font/google";
import "./globals.css";
import StructuredData from "./components/StructuredData";
import PWARegister from "./components/PWARegister";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NovuraHealth — AI-Powered GLP-1 Medication Companion",
  description:
    "Track your Ozempic, Wegovy, Mounjaro, or Zepbound journey with an AI health coach. Log injections, nutrition, weight, side effects, and get personalized coaching.",
  keywords: [
    "GLP-1 tracker",
    "Ozempic tracker",
    "Wegovy app",
    "Mounjaro tracker",
    "Zepbound tracker",
    "semaglutide tracker",
    "tirzepatide tracker",
    "GLP-1 weight loss app",
    "GLP-1 AI coach",
  ],
  metadataBase: new URL("https://novurahealth.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "NovuraHealth — AI-Powered GLP-1 Medication Companion",
    description:
      "Track your Ozempic, Wegovy, Mounjaro, or Zepbound journey with an AI health coach. Log injections, nutrition, weight, side effects, and get personalized coaching.",
    url: "https://novurahealth.com",
    siteName: "NovuraHealth",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "NovuraHealth",
      },
    ],
    type: "website",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "theme-color": "#2D5A3D",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <StructuredData />
        <PWARegister />
        <Toaster position="top-center" richColors />
        {children}
      </body>
    </html>
  );
}
