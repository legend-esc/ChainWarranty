import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChainWarranty — Product Authenticity & Warranty Registry",
  description:
    "Verify product authenticity and warranty status using the Stellar/Soroban blockchain.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
