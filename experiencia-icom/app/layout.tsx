import type { Metadata } from "next";
import "./globals.css";
import "./icom.css";

export const metadata: Metadata = {
  title: "Experiência Icom",
  description: "Sua opinião nos leva mais longe.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/experiencia-icom/favicon.svg",
    shortcut: "/experiencia-icom/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
