import './globals.css';
import type { ReactNode } from 'react';
import { SoloCliente } from './SoloCliente';

export const metadata = {
  title: { default: 'ReservaITN', template: '%s · ReservaITN' },
  description: 'Reservas de salas y laboratorios del Instituto Técnico del Norte',
};
export const viewport = { themeColor: '#0e2347' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <SoloCliente>{children}</SoloCliente>
      </body>
    </html>
  );
}
