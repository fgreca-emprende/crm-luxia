import { describe, it, expect } from 'vitest';
const { XP_TABLE } = require('../services/gamificationService');

describe('Gamification Service', () => {
  it('should have standard XP point values defined for commercial actions', () => {
    expect(XP_TABLE.crear_lead).toBe(25);
    expect(XP_TABLE.ganar_oportunidad).toBe(150);
    expect(XP_TABLE.aprobar_examen).toBe(100);
    expect(XP_TABLE.crear_contrato).toBe(50);
  });

  it('should calculate progression levels accurately', () => {
    const calcLevel = (xp) => Math.floor(xp / 200) + 1;
    expect(calcLevel(0)).toBe(1);
    expect(calcLevel(199)).toBe(1);
    expect(calcLevel(200)).toBe(2);
    expect(calcLevel(550)).toBe(3);
  });
});
