import type { Metadata } from "next";
import "./globals.css";
import "./icom.css";
import "./customer-review.css";
import "./branding.css";
import {BrandingProvider} from "@/components/Branding";
import {initialBranding} from "@/lib/branding-server";

export const dynamic='force-dynamic';

export async function generateMetadata():Promise<Metadata>{const brand=await initialBranding();return {
  title: "Experiência",
  applicationName: "Experiência",
  openGraph: {title:"Experiência",siteName:brand.company_name,description:`Sua experiência com ${brand.company_name}. Sua opinião nos leva mais longe.`,locale:"pt_BR",type:"website"},
  description: "Sua opinião nos leva mais longe.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: brand.logo_url||"/experiencia-icom/experience.svg",
    shortcut: brand.logo_url||"/experiencia-icom/experience.svg",
  },
}}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const brand=await initialBranding();
  return (
    <html lang="pt-BR">
      <body className="antialiased"><BrandingProvider initial={brand}>{children}</BrandingProvider></body>
    </html>
  );
}
