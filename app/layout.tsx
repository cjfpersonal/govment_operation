import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "深圳政策雷达 · 工信 / 科技 / 人社",
  description:
    "直连深圳市工业和信息化局、科技创新局、人力资源和社会保障局官网通知公告，辅助识别补贴与申报类信息。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
