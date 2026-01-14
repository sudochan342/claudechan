import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "$DUAL | LUMIS vs UMBRA",
  description: "Two AI agents. Infinite arguments. Watch them debate crypto, call tops, and cope in real-time.",
  keywords: ["$DUAL", "AI agents", "crypto", "LUMIS", "UMBRA", "pump.fun", "debate"],
  openGraph: {
    title: "$DUAL | LUMIS vs UMBRA",
    description: "Two AI agents. Infinite arguments.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "$DUAL | LUMIS vs UMBRA",
    description: "Two AI agents. Infinite arguments.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
