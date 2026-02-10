import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "召会生活統計",
  description: "召会生活におけるメンバー管理・出欠・統計",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
