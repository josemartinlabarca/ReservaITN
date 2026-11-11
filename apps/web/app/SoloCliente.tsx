'use client';
import { useEffect, useState, type ReactNode } from 'react';

/**
 * Muestra la aplicación solo en el navegador. Todas las páginas dependen de la sesión
 * (localStorage) y de la hora actual, que no existen al generarlas en el servidor; renderizarlas
 * allí produce diferencias de hidratación (React #418). Es una app con login, sin necesidad de SEO.
 */
export function SoloCliente({ children }: { children: ReactNode }) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  return montado ? <>{children}</> : null;
}
