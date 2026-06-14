import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import { Providers } from './providers';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { clerkEnabled } from '@/lib/auth';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'BananaMOV — AI Video Scoring',
  description:
    'Upload a video and receive a custom AI-generated music score matched to its mood, energy, and visual arc. Powered by ElevenLabs.',
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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`}>
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
