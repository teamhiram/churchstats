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
      <body
        className="antialiased min-h-screen bg-[var(--background)] text-[var(--foreground)]"
        style={{ minHeight: "100vh", backgroundColor: "#f8fafc", color: "#0f172a" }}
      >
        {children}
      </body>
    </html>
  );
}
