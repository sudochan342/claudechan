import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/components/WalletProvider";

export const metadata: Metadata = {
  title: "The Duality Oracle | LUMIS & UMBRA",
  description: "Two AI minds debate topics together, reaching unified insights through the dance of light and shadow. Watch them think, question, and synthesize.",
  keywords: ["AI", "debate", "oracle", "philosophy", "dual agents", "yin yang", "synthesis"],
  openGraph: {
    title: "The Duality Oracle",
    description: "Two AI minds, one truth — watch them think together",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Duality Oracle",
    description: "Two AI minds, one truth — watch them think together",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-gray-950 text-gray-100 font-sans">
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
