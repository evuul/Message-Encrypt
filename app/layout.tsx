import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MessageEncrypt",
  description: "Saker delning av krypterade engangsmeddelanden"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}
