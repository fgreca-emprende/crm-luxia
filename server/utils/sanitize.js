/**
 * Helper de Sanitización de Inputs para Prompts de IA y Endpoints
 * Previene Prompt Injection, DoS por payload excesivo y caracteres de control maliciosos.
 */

const MAX_PROMPT_LEN = 2000;
const MAX_CTX_LEN = 5000;

/**
 * Sanitiza un string de usuario para uso seguro en un prompt de IA.
 * - Trunca a maxLen caracteres
 * - Elimina caracteres de control (NUL, BEL, etc.) excepto saltos de línea y tabulaciones
 * - Neutraliza intentos de inyección de delimitadores de system prompt
 */
function sanitizeUserInput(str, maxLen = MAX_PROMPT_LEN) {
  if (!str || typeof str !== 'string') return '';
  return str
    .slice(0, maxLen)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Caracteres de control
    .replace(/---\s*(system|assistant|user|model)\s*---/gi, '[BLOQUE]') // Delimitadores clásicos
    .replace(/<\|im_(start|end|sep)\|>/gi, '[SEP]') // Tokens especiales ChatML
    .replace(/\[INST\]|\[\/INST\]|<<SYS>>|<\/SYS>>/gi, '[TOKEN]') // Tokens Llama / Gemini tags
    .trim();
}

/**
 * Sanitiza un objeto de contexto para incluir de forma segura en prompts.
 * Solo permite tipos primitivos (string, number, boolean, null) y trunca cadenas.
 */
function sanitizeContext(ctx, maxLen = MAX_CTX_LEN) {
  if (!ctx || typeof ctx !== 'object') return {};
  const safe = {};
  for (const [k, v] of Object.entries(ctx)) {
    // Sanitizar clave
    const safeKey = sanitizeUserInput(String(k), 50);
    if (!safeKey) continue;

    if (typeof v === 'string') {
      safe[safeKey] = sanitizeUserInput(v, 500);
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      safe[safeKey] = v;
    } else if (v === null) {
      safe[safeKey] = null;
    }
    // Omitir arrays o sub-objetos anidados no estructurados por seguridad
  }
  const serialized = JSON.stringify(safe);
  return serialized.length <= maxLen ? safe : {};
}

module.exports = {
  sanitizeUserInput,
  sanitizeContext
};
