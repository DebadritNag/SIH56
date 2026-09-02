import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/lib/providers/QueryProvider";
import { AuthProvider } from "@/lib/providers/AuthProvider";
import { DataModeProvider } from "@/lib/providers/DataModeProvider";
import { NotificationProvider } from "@/components/notifications/NotificationProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AirPulse — Real-Time Airfare Price Index for India (CPI Augmentation)",
  description: "Official National Airfare Price Intelligence Platform for MoSPI and RBI economists. Automated web scraping of airline and OTA portals for Consumer Price Index augmentation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
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
