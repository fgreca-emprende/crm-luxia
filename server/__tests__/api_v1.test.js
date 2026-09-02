import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import apiRouter from '../routes/api';

describe('API Gateway v1 Endpoints & Input Validation', () => {
  it('debe rechazar solicitudes a /v1/leads sin API Key con HTTP 401', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', apiRouter);

    // Mock response simulation
    const req = { header: () => null };
    const res = {
      status: (code) => {
        expect(code).toBe(401);
        return { json: (body) => expect(body.error).toContain('API Key requerida') };
      }
    };

    // Trigger middleware Directly
    const middleware = apiRouter.stack.find(layer => layer.route && layer.route.path === '/v1/leads').route.stack[0].handle;
    await middleware(req, res, () => {});
  });

  it('debe validar formato de correo electrónico inválido en /public/web-to-lead', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', apiRouter);

    const mockReq = {
      body: {
        nombreEmpresa: 'Empresa Test',
        correo: 'correo-invalido-sin-arroba'
      },
      app: { get: () => ({}) }
    };

    const mockRes = {
      status: (code) => {
        expect(code).toBe(400);
        return { json: (body) => expect(body.error).toContain('Formato de correo') };
      }
    };

    const handler = apiRouter.stack.find(layer => layer.route && layer.route.path === '/public/web-to-lead').route.stack[0].handle;
    await handler(mockReq, mockRes, () => {});
  });
});
