import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
const sans=Inter({variable:'--font-inter',subsets:['latin']});
const mono=JetBrains_Mono({variable:'--font-jetbrains-mono',subsets:['latin']});
export const metadata:Metadata={title:'QueueIQ - Pusat kendali request',description:'Kelola request belanja dan antrean pesanan dalam satu ruang kerja.',icons:{icon:'/queueiq-logo.jpg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="id" className="dark"><body className={`${sans.variable} ${mono.variable}`}>{children}</body></html>}
