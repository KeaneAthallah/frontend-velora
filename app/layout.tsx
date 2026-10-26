import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const font = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font" });

export const metadata: Metadata = {
  title: "Velora: Smarter business. Easier sales.",
  icons: { icon: "/brand/velora_app_icon_light.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={font.variable}><Providers>{children}</Providers></body>
    </html>
  );
}
