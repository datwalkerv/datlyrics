import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { SearchPalette } from "@/components/SearchPalette";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "datlyrics",
  description: "Premium synced lyrics player for YouTube songs and playlists.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} h-full bg-neutral-950 antialiased`}>
      <body className="min-h-full">
        {children}
        <SearchPalette />
      </body>
    </html>
  );
}
