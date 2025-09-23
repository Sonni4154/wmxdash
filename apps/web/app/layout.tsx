import './globals.css'

export const metadata = {
  title: 'Employee Dashboard',
  description: 'Clean monorepo UI',
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
