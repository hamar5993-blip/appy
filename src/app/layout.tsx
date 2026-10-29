import type { Metadata } from "next";
import { Inter, Tajawal } from "next/font/google";
import "./globals.css";
import { SettingsProvider } from "@/components/settings";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const tajawal = Tajawal({ subsets: ["arabic"], weight: ["400", "500", "700", "800"], variable: "--font-tajawal" });

export const metadata: Metadata = {
  title: "Easier — AI Study Companion",
  description: "Smarter studying starts here — turn your materials into summaries, flashcards and visual maps.",
  verification: {
    other: { "waffo-verify": "57f2aabec64f0588b6adfdcbeb040743" },
  },
  metadataBase: new URL("https://appy-nine-nu.vercel.app"),
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${tajawal.variable} antialiased`}>
        <SettingsProvider>
          {children}
          <Toaster position="bottom-center" richColors closeButton />
        </SettingsProvider>
      </body>
    </html>
  );
}
