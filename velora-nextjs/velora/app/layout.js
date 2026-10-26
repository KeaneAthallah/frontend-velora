import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
const font = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font" });
export const metadata = { title: "Velora: Smarter business. Easier sales.", icons: { icon: "/brand/velora_app_icon_light.png" } };
export default function Root({ children }) {
  return <html lang="en"><body className={font.variable}>{children}</body></html>;
}
