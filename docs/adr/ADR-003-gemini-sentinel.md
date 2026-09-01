# ADR-003: Arquitectura de Agentes Sentinel IA con Google Gemini 3

## Estado
Aceptado (2026-09-01)

## Contexto
El CRM Luxia implementa 13 agentes inteligentes autónomos y asistenciales (Scoring de leads, análisis de salud de cuenta, copiloto por voz, triage de bitácora, etc.) que requieren modelos con soporte multimodal, razonamiento estructurado en JSON y baja latencia.

## Decisión
1. Utilizar el SDK oficial `@google/genai` con la familia de modelos **Gemini 3**:
   - `gemini-3.5-flash-lite`: Operaciones de alta frecuencia, triage de WhatsApp y soporte RAG.
   - `gemini-3.5-flash`: Operaciones principales de producción, scoring ICP y auditoría de pipeline.
   - `gemini-3.6-flash`: Análisis contractual y razonamiento legal complejo.
   - `gemini-3.7-flash`: Agentes complejos multi-paso y Metrics Studio Architect.
2. Centralizar la configuración de prompts en la tabla `public.config_ia` para permitir ajuste de hiperparámetros sin redespacho de código.
3. Registrar la telemetría de tokens y costos en `public.logs_ia_consumo`.
