import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/navbar";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import FloatingChatMount from "@/components/chat/FloatingChatMount";

export const metadata: Metadata = {
  title: "AuraSpa",
  icons: {
    icon: "/aura-icon.svg",
    shortcut: "/aura-icon.svg",
    apple: "/aura-icon.svg",
  },
  description: "Nơi Tĩnh Lặng Gặp Gỡ Sự Sang Trọng",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Manrope:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <LanguageProvider>
          <AuthProvider>
            <Navbar />
            {children}
            <FloatingChatMount />
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
