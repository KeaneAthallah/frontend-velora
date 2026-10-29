import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const font = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font" });

export const metadata: Metadata = {
  title: {
    default: "Velora: Smarter business. Easier sales.",
    template: "%s · Velora",
  },
  description:
    "Velora is a calm, precise point-of-sale and retail operations workspace for growing businesses.",
  applicationName: "Velora",
  icons: {
    icon: "/brand/velora_app_icon_light.png",
    apple: "/brand/velora_app_icon_light.png",
    shortcut: "/brand/velora_app_icon_light.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0d1c" },
  ],
};

const themeScript = `
try {
  var t = localStorage.getItem("theme") || "system";
  var d = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", d);
  document.documentElement.style.colorScheme = d ? "dark" : "light";
  var href = d ? "/brand/velora_app_icon_dark.png" : "/brand/velora_app_icon_light.png";
  ["icon", "shortcut icon", "apple-touch-icon"].forEach(function (rel) {
    document.querySelectorAll('link[rel="' + rel + '"]').forEach(function (l) {
      l.setAttribute("href", href);
    });
  });
} catch (e) {}
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={font.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
