import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voice Chat | Real-time AI",
  description: "A real-time speech-to-speech voice assistant powered by Inworld.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
