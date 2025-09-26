import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { AccessibilityProvider, AccessibilityControls } from "@/components/accessibility/accessibility-provider";
import { HybridAuthProvider } from "@/contexts/hybrid-auth-context";
import { PWAProvider } from "@/components/pwa/pwa-provider";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "家族の音声メッセージ | WakeUp",
  description: "家族や親しい友人と音声メッセージで心温まるつながりを。感情分析と音声認識機能付きの次世代コミュニケーションアプリ。",
  keywords: "音声メッセージ,家族,コミュニケーション,音声認識,感情分析,PWA",
  authors: [{ name: "WakeUp Team" }],
  creator: "WakeUp",
  publisher: "WakeUp",
  robots: "index, follow",
  openGraph: {
    type: "website",
    siteName: "WakeUp - 家族の音声メッセージ",
    title: "家族の音声メッセージ | WakeUp",
    description: "家族や親しい友人と音声メッセージで心温まるつながりを",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "WakeUp - 家族の音声メッセージアプリ"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "家族の音声メッセージ | WakeUp",
    description: "家族や親しい友人と音声メッセージで心温まるつながりを",
    images: ["/og-image.png"]
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "WakeUp"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#3b82f6",
  colorScheme: "light dark"
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        <PWAProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <HybridAuthProvider>
              <AccessibilityProvider>
                {children}
                <AccessibilityControls />
              </AccessibilityProvider>
            </HybridAuthProvider>
          </ThemeProvider>
        </PWAProvider>
      </body>
    </html>
  );
}
