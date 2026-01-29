import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import clsx from "clsx";
import "./globals.css";
import ClientShell from "./ClientShell";

export const metadata: Metadata = {
  title: "GPT Protocol",
  description: "GPT Protocol - Decentralized AI",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

const instrument = Instrument_Sans({ subsets: ["latin"], weight: "variable" });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-dvh-safe">
      <body
        className={clsx(
          instrument.className,
          "h-full bg-zinc-900 overflow-hidden overscroll-none subpixel-antialiased",
        )}
      >
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
