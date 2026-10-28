import './globals.css';
import type { ReactNode } from 'react';

export const metadata = { title: 'ReservaITN', description: 'Reservas de salas y laboratorios – ITN' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
