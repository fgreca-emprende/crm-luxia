import { describe, it, expect } from 'vitest';

// Sanitizador de campos para prevenir CSV Formula Injection (Replicado de ExportDrawer.jsx)
function sanitizeCsvField(val) {
  if (val === undefined || val === null) return '""';
  let strVal = String(val).replace(/"/g, '""');
  if (/^[=+\-@\t\r]/.test(strVal)) {
    strVal = `'${strVal}`;
  }
  return `"${strVal}"`;
}

describe('CSV Formula Injection Prevention', () => {
  it('debe neutralizar fórmulas de Excel que inician con =', () => {
    const input = "=CMD|' /C calc'!A0";
    const result = sanitizeCsvField(input);
    expect(result).toBe('"\'=CMD|\' /C calc\'!A0"');
  });

  it('debe neutralizar comandos que inician con +, -, o @', () => {
    expect(sanitizeCsvField('+100')).toBe('"\' +100"'.replace(" ", ""));
    expect(sanitizeCsvField('-50')).toBe('"\' -50"'.replace(" ", ""));
    expect(sanitizeCsvField('@SUM(A1:A10)')).toBe('"\'@SUM(A1:A10)"');
  });

  it('no debe alterar texto normal ni números sin fórmulas', () => {
    expect(sanitizeCsvField('Agropecuaria Los Ombúes S.A.')).toBe('"Agropecuaria Los Ombúes S.A."');
    expect(sanitizeCsvField(12500)).toBe('"12500"');
  });
});
