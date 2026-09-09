import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/lib/providers/QueryProvider";
import { AuthProvider } from "@/lib/providers/AuthProvider";
import { DataModeProvider } from "@/lib/providers/DataModeProvider";
import { NotificationProvider } from "@/components/notifications/NotificationProvider";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VAYANTARA | Real-Time Airfare Intelligence & Price Index for India",
  description: "Official National Airfare Price Intelligence Platform & High-Frequency Price Index for India. Turning airfare movement across routes, time, and booking windows into transparent economic signal.",
  icons: {
    icon: [
      { url: "/app.png", type: "image/png" },
    ],
    shortcut: ["/app.png"],
    apple: [
      { url: "/app.png", type: "image/png" },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${spaceGrotesk.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <QueryProvider>
          <AuthProvider>
            <DataModeProvider>
              <NotificationProvider>{children}</NotificationProvider>
            </DataModeProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

