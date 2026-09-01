import { describe, it, expect } from 'vitest';
import { mapLeadFromDB, mapLeadToDB } from '../useLeadsPaginados';

describe('useLeadsPaginados - Data Mappers', () => {
  it('mapLeadFromDB should properly map snake_case database fields to camelCase', () => {
    const rawDB = {
      id: 'lead-123',
      nombre_empresa: 'Agrícola Los Andes S.A.',
      nombre_contacto: 'Carlos Mendoza',
      correo: 'carlos@losandes.com',
      telefono: '+5491112345678',
      pais: 'AR',
      score_calculado: 85,
      estado: 'contactado',
      created_at: '2026-09-01T12:00:00Z'
    };

    const mapped = mapLeadFromDB(rawDB);

    expect(mapped.id).toBe('lead-123');
    expect(mapped.nombreEmpresa).toBe('Agrícola Los Andes S.A.');
    expect(mapped.nombreContacto).toBe('Carlos Mendoza');
    expect(mapped.correo).toBe('carlos@losandes.com');
    expect(mapped.email).toBe('carlos@losandes.com');
    expect(mapped.scoreCalculado).toBe(85);
    expect(mapped.estado).toBe('contactado');
  });

  it('mapLeadToDB should serialize camelCase lead object to snake_case DB schema', () => {
    const lead = {
      id: 'lead-456',
      nombreEmpresa: 'Agropecuaria Pampeana',
      nombreContacto: 'Laura Rossi',
      correo: 'laura@pampeana.com',
      telefono: '+5491198765432',
      pais: 'AR',
      estado: 'nuevo',
      scoreCalculado: 90
    };

    const dbObj = mapLeadToDB(lead);

    expect(dbObj.id).toBe('lead-456');
    expect(dbObj.nombre_empresa).toBe('Agropecuaria Pampeana');
    expect(dbObj.nombre_contacto).toBe('Laura Rossi');
    expect(dbObj.correo).toBe('laura@pampeana.com');
    expect(dbObj.score_calculado).toBe(90);
    expect(dbObj.estado).toBe('nuevo');
  });

  it('mapLeadFromDB should return null for falsy input', () => {
    expect(mapLeadFromDB(null)).toBeNull();
    expect(mapLeadFromDB(undefined)).toBeNull();
  });
});
