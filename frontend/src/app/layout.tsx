import type { Metadata } from "next";
// Temporarily disabled due to network restrictions in containerized environment
// import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// const inter = Inter({
//   subsets: ["latin"],
//   variable: "--font-sans",
// });

export const metadata: Metadata = {
  title: "Garment Supply Chain Platform",
  description: "Complete supply chain management system for garment manufacturing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>
          {children}
        </Providers>
        <div id="portal" />
      </body>
    </html>
  );
}
