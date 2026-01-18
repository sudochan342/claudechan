import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PumpFun Bot",
  description: "Solana PumpFun trading bot with spread buy functionality",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-gray-950 text-gray-100 font-sans">
        {children}
      </body>
    </html>
  );
}
