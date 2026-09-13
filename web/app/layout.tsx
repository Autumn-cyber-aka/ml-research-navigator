import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'ML Research Navigator',
  description:
    'Discover papers, build reading lists, and discuss ideas. Fictional sample catalogue for learning.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
