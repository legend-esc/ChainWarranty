/**
 * QrDisplay — renders a QR code for a verification URL and provides a
 * download button.
 *
 * Uses the `qrcode` npm package (pure JS, no native deps) to generate the
 * QR image as a data URL, consistent with README.md's Tech stack table.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

interface QrDisplayProps {
  /** Full verification URL to encode in the QR code. */
  url: string;
  /** Raw serial number — shown in the UI for reference only. */
  serial: string;
}

export function QrDisplay({ url, serial }: QrDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      setError(null);
      try {
        // Dynamic import so the qrcode package is only loaded in the browser
        const QRCode = (await import("qrcode")).default;
        if (!canvasRef.current || cancelled) return;

        await QRCode.toCanvas(canvasRef.current, url, {
          width: 256,
          margin: 2,
          color: { dark: "#0f172a", light: "#ffffff" },
        });

        setDataUrl(canvasRef.current.toDataURL("image/png"));
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "QR generation failed"
          );
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [url]);

  function handleDownload() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `chainwarranty-qr-${serial.replace(/[^a-zA-Z0-9-_]/g, "_")}.png`;
    a.click();
  }

  return (
    <div
      style={{
        background: "#f0fdf4",
        border: "1px solid #86efac",
        borderRadius: 8,
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: "1.5rem" }}>✅</span>
        <div>
          <strong style={{ display: "block" }}>Token minted successfully!</strong>
          <span style={{ fontSize: "0.85rem", color: "#166534" }}>
            Serial: <code>{serial}</code>
          </span>
        </div>
      </div>

      {error ? (
        <p style={{ color: "#dc2626", fontSize: "0.9rem" }}>
          QR generation failed: {error}
        </p>
      ) : (
        <>
          <canvas
            ref={canvasRef}
            style={{ display: "block", borderRadius: 4 }}
            aria-label={`QR code for ${url}`}
          />
          <p
            style={{
              fontSize: "0.75rem",
              color: "#64748b",
              wordBreak: "break-all",
            }}
          >
            {url}
          </p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Button
              variant="primary"
              onClick={handleDownload}
              disabled={!dataUrl}
            >
              Download QR PNG
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                navigator.clipboard
                  .writeText(url)
                  .then(() => alert("URL copied to clipboard!"))
                  .catch(() => {});
              }}
            >
              Copy URL
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
