import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Landscape Plan AI | 景观设计智能出图 Demo",
  description:
    "上传一张景观设计草图，自动生成彩色总平面图、功能分区图、流线设计图、竖向设计图、剖面图、节点放大图、鸟瞰图、人视点效果图和爆炸分析图。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}