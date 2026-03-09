import '@/styles/globals.css';

export const metadata = {
  title: 'CreatorFind — YouTube Creator Discovery & Outreach',
  description: 'Discover YouTube creators, collect channel data, and automate outreach with personalized emails.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
