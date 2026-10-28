import { describe, expect, it } from 'vitest';
import { horasDisponiblesPorSala } from './dashboard.module';

describe('horasDisponiblesPorSala', () => {
  it('cuenta lunes a sábado × 15 horas', () => {
    // 09/11/2026 (lunes) a 16/11/2026: 6 días hábiles
    expect(horasDisponiblesPorSala(new Date(2026, 10, 9), new Date(2026, 10, 16))).toBe(90);
  });
});
