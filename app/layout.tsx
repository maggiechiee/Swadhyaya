export const metadata = {
  title: 'Swadhyāya',
  description: 'Know yourself. Transform everything.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}