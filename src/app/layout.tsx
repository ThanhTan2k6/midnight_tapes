import type { Metadata } from "next";
import { Inter, Patrick_Hand, VT323 } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
});

const patrickHand = Patrick_Hand({
  weight: "400",
  variable: "--font-patrick-hand",
  subsets: ["latin", "vietnamese"],
});

const vt323 = VT323({
  weight: "400",
  variable: "--font-vt323",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tiệm Băng Nửa Đêm | Midnight Tapes",
  description:
    "Thả nỗi buồn vào cuộn băng, nghe người xa lạ gửi lời ủi an. Không gian tâm sự ẩn danh tự hủy sau 24 giờ.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${inter.variable} ${patrickHand.variable} ${vt323.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-midnight-void text-tea-steam selection:bg-amber-lamp/30">
        {children}
      </body>
    </html>
  );
}
