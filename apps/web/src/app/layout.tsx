import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';
import { Hydrate } from '@/components/Hydrate';
import { Toaster } from '@/components/ui';

const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-poppins' });

export const metadata: Metadata = {
  title: 'Córtex',
  description: 'O cérebro da sua empresa: frentes de negócio, jornadas e capacidades técnicas.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={poppins.variable}>
      <body className="font-sans antialiased">
        <Hydrate>{children}</Hydrate>
        <Toaster />
      </body>
    </html>
  );
}
