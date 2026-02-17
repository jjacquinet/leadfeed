import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Outbounder AI — Lead Feed',
  description: 'Warm lead inbox for outbound sales campaigns',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-100">
        {children}
      </body>
    </html>
  );
}
