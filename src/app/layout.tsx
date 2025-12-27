import type { Metadata } from "next";
import { Space_Grotesk, Work_Sans } from "next/font/google";
import { Providers } from "../../components/Providers";
import "../../styles/globals.css";

const workSans = Work_Sans({ subsets: ["latin"], variable: "--font-sans" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Tempo Memo Console",
  description: "Transfer stablecoins with IVMS memos on Tempo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${workSans.variable} ${spaceGrotesk.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
