import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "English BRo — Your AI English Speaking Partner",
  description:
    "Practice spoken English with English BRo, a friendly AI voice agent that chats naturally and gently corrects your grammar in real time.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
