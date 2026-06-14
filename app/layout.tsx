import type { Metadata } from 'next';
import { Geist, Geist_Mono, Bricolage_Grotesque } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import { Providers } from './providers';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { clerkEnabled } from '@/lib/auth';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
const bricolage = Bricolage_Grotesque({
  variable: '--font-bricolage',
  subsets: ['latin'],
  weight: ['600', '700', '800'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'BananaMOV — AI Video Scoring',
  description:
    'Upload a video and receive a custom AI-generated music score matched to its mood, energy, and visual arc. Powered by ElevenLabs.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/banana-logo.svg', type: 'image/svg+xml' },
    ],
    apple: '/banana-logo.svg',
  },
  openGraph: {
    title: 'BananaMOV — AI Video Scoring',
    description:
      'Upload a video and receive a custom AI-generated music score matched to its mood, energy, and visual arc. Powered by ElevenLabs.',
    siteName: 'BananaMOV',
    type: 'website',
    images: [{ url: '/banana-logo.svg', alt: 'BananaMOV' }],
  },
  twitter: {
    card: 'summary',
    title: 'BananaMOV — AI Video Scoring',
    description:
      'AI-generated music scores matched to your video’s mood, energy, and visual arc.',
    images: ['/banana-logo.svg'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const tree = (
    <Providers>
      <div className="flex min-h-screen flex-col bg-navy-950 text-cream-50">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </div>
    </Providers>
  );

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} dark`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Global icon font loaded in the root layout (applies to all routes). */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" />
      </head>
      <body className="min-h-screen antialiased">
        {clerkEnabled ? (
          <ClerkProvider afterSignOutUrl="/" appearance={{ variables: { colorPrimary: '#ffcc18' } }}>
            {tree}
          </ClerkProvider>
        ) : (
          tree
        )}
      </body>
    </html>
  );
}
