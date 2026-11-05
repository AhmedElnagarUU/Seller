import type { Metadata } from "next";
import { StoreFooter } from "@/shared/layout/StoreFooter";
import { StoreHeader } from "@/shared/layout/StoreHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Theme Store",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-text flex min-h-screen flex-col font-sans antialiased">
        <StoreHeader accountSlot={null} />
        <main className="flex-1">{children}</main>
        <StoreFooter />
      </body>
    </html>
  );
}
