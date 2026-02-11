import type { Metadata } from "next";
import localFont from "next/font/local";
import { SessionProvider } from "next-auth/react";
import SmoothScroll from "@/components/SmoothScroll";
import "./globals.css";

const bebasNeue = localFont({
  src: "../public/fonts/BebasNeue-Regular.woff2",
  variable: "--font-bebas",
  display: "swap",
});

const openSans = localFont({
  src: "../public/fonts/OpenSans-Latin.woff2",
  variable: "--font-opensans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HHS PhotoHub",
  description: "HHS PhotoHub — Secure photo upload & management. A demo product by OCIO, rebrandable for any OpDiv.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${bebasNeue.variable} ${openSans.variable} antialiased`}>
        <SessionProvider>
          <SmoothScroll>{children}</SmoothScroll>
        </SessionProvider>
      </body>
    </html>
  );
}
