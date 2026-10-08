import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "4rem 1rem" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1rem" }}>
        ChainWarranty
      </h1>
      <p style={{ color: "#475569", marginBottom: "2rem" }}>
        On-chain product authenticity &amp; warranty registry, built on
        Stellar/Soroban. Scan the QR code on your product to verify
        authenticity and warranty status.
      </p>
      <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
        Have a serial number?{" "}
        <Link href={`/verify/${process.env["NEXT_PUBLIC_CONTRACT_ID"] ?? "CONTRACT_ID"}/SERIAL`}>
          Open the verification page
        </Link>
      </p>
    </main>
  );
}
