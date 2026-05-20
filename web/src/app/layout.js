import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata = {
  title: "European Climate & Living Costs Dashboard",
  description: "Interactive map of European climate data, cost of living, and climate change projections for 230+ cities.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "European Climate & Living Costs Dashboard",
    description: "Interactive map of European climate data, cost of living, and climate change projections for 230+ cities.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "European Climate & Living Costs Dashboard",
    description: "Interactive map of European climate data, cost of living, and climate change projections for 230+ cities.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
