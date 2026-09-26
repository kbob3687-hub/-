import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "无意义博物馆 · 历史上的无意义时刻",
  description: "发现目标之外发生的发现，与历史上的无用时刻共振。",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
