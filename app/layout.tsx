import '../styles/globals.css'
import { Space_Grotesk, Work_Sans } from 'next/font/google'

const workSans = Work_Sans({ subsets: ['latin'], variable: '--font-sans' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${workSans.variable} ${spaceGrotesk.variable}`}>{children}</body>
    </html>
  )
}
