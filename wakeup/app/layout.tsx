import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { AccessibilityProvider, AccessibilityControls } from "@/components/accessibility/accessibility-provider";
import { AuthProvider } from "@/contexts/auth-context";
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
  themeColor: "#3b82f6",
  colorScheme: "light dark",
  viewport: "width=device-width, initial-scale=1, maximum-scale=5",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "WakeUp"
  }
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
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <AccessibilityProvider>
              {children}
              <AccessibilityControls />
            </AccessibilityProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
