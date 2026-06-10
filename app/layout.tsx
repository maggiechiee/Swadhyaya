import type { ReactNode } from 'react';

export const metadata = {
  title: 'Swadhyāya',
  description: 'Your inner life, made visible.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}