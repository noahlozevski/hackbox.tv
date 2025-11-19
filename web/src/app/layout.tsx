import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "hackbox.tv – realtime browser games with friends",
  description:
    "Spin up a hackbox room, drop a link, and play chaotic real‑time games in your browser.",
  openGraph: {
    title: "hackbox.tv – realtime browser games with friends",
    description:
      "Spin up a hackbox room, drop a link, and play chaotic real‑time games in your browser.",
    url: "https://hackbox.tv.lozev.ski/",
    siteName: "hackbox.tv",
    images: [
      {
        url: "https://hackbox.tv.lozev.ski/og_image.jpg",
        width: 1200,
        height: 630,
        alt: "hackbox.tv – browser-based party games and chat",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
