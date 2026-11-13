import type { ReactNode } from 'react';
import { Panel } from '@/components/Panel';

/** Toda ruta dentro de app/(panel) exige sesión y se dibuja con el menú lateral (el grupo no aparece en la URL). */
export default function LayoutPanel({ children }: { children: ReactNode }) {
  return <Panel>{children}</Panel>;
}
