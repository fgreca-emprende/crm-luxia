import { describe, it, expect } from 'vitest';
import { getErrorMessage } from '../errors';

describe('Error Handling Utility (getErrorMessage)', () => {
  it('should return safe message for 42501 RLS error', () => {
    const error = { code: '42501', message: 'new row violates row-level security policy for table "clientes"' };
    const msg = getErrorMessage(error);
    expect(msg).toBe('No tienes permisos para realizar esta acción (RLS).');
  });

  it('should return safe message for duplicate 23505 error', () => {
    const error = { code: '23505', message: 'duplicate key value violates unique constraint' };
    const msg = getErrorMessage(error);
    expect(msg).toBe('Este registro ya existe (duplicado).');
  });

  it('should handle string error messages containing known error keywords', () => {
    const error = new Error('JWT expired at 1788143305');
    const msg = getErrorMessage(error);
    expect(msg).toBe('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
  });

  it('should return generic fallback for unknown errors without leaking technical details', () => {
    const error = { message: 'FATAL: database "internal_db_name" connection failed at host 10.0.0.5' };
    const msg = getErrorMessage(error);
    expect(msg).toBe('Ocurrió un error inesperado. Por favor, inténtalo de nuevo.');
  });

  it('should handle null or undefined error gracefully', () => {
    expect(getErrorMessage(null)).toBe('Ocurrió un error inesperado.');
    expect(getErrorMessage(undefined)).toBe('Ocurrió un error inesperado.');
  });
});
