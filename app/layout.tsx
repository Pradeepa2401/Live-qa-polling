import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Q&A",
  description:
    "Live Q&A and Polling System",
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
