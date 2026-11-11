import './globals.css';
import type { ReactNode } from 'react';
import { SoloCliente } from './SoloCliente';

export const metadata = { title: 'ReservaITN', description: 'Reservas de salas y laboratorios – ITN' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <SoloCliente>{children}</SoloCliente>
      </body>
    </html>
  );
}
