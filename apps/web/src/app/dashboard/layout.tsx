/**
 * Dashboard layout — wraps all /dashboard/* routes with the wallet provider
 * and a persistent nav/connect bar.
 */
import type { Metadata } from "next";
import { WalletProvider } from "@/lib/wallet-context";
import { DashboardNav } from "@/components/dashboard/DashboardNav";

export const metadata: Metadata = {
  title: "Manufacturer Dashboard — ChainWarranty",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WalletProvider>
      <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
        <DashboardNav />
        <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem" }}>
          {children}
        </main>
      </div>
    </WalletProvider>
  );
}
