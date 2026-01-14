import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "$DUAL - The Duality Oracle",
  description: "Two AI minds. One truth. Watch LUMIS and UMBRA debate any topic and reach synthesis together. The first AI debate protocol.",
  keywords: ["$DUAL", "AI", "debate", "oracle", "crypto", "pump.fun", "LUMIS", "UMBRA", "synthesis"],
  openGraph: {
    title: "$DUAL - The Duality Oracle",
    description: "Two AI minds. One truth. The first AI debate protocol.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "$DUAL - The Duality Oracle",
    description: "Two AI minds. One truth. The first AI debate protocol.",
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
