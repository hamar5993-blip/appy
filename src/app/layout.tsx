import type { Metadata } from "next";
import { Inter, Tajawal } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const tajawal = Tajawal({ subsets: ["arabic"], weight: ["400", "500", "700", "800"], variable: "--font-tajawal" });

export const metadata: Metadata = {
  title: "Easier — AI Study Companion",
  description: "Smarter studying starts here — turn your materials into summaries, flashcards, audio lessons and visual maps.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${tajawal.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
