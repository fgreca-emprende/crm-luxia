const { GoogleGenAI } = require('@google/genai');

let aiInstance = null;

function getAiClient() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("[LUXIA IA] Advertencia: GEMINI_API_KEY no está configurada en las variables de entorno.");
      return null;
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

/**
 * Orquestador Core para todas las llamadas a Gemini en CRM-Luxia con Supabase
 * @param {object} params
 * @param {string} params.agenteId - Identificador del agente (ej. 'luxia', 'luxia_lead_scorer')
 * @param {string} params.prompt - Entrada a procesar
 * @param {string} [params.userEmail] - Email del usuario solicitante
 * @param {object} [params.contextInfo] - Metadatos de contexto (clienteId, etc.)
 * @param {object} params.supabase - Cliente Supabase Admin
 */
async function generateLuxiaContent({ agenteId, prompt, userEmail = "System (Auto)", contextInfo = {}, supabase }) {
  try {
    // 1. Obtener la configuración del agente desde PostgreSQL
    const { data: agentConfig, error: configError } = await supabase
      .from('config_ia')
      .select('*')
      .eq('id', agenteId)
      .single();

    if (configError || !agentConfig) {
      console.warn(`[LUXIA IA] No se encontró configuración para el agente ${agenteId}. Usando valores por defecto.`);
    }

    if (agentConfig && agentConfig.disabled === true) {
      console.warn(`[LUXIA IA] Agente ${agenteId} desactivado globalmente.`);
      return {
        success: false,
        error: `Agente IA Deshabilitado (${agenteId})`
      };
    }

    const ai = getAiClient();
    if (!ai) {
      return {
        success: false,
        error: "GEMINI_API_KEY no disponible"
      };
    }

    const systemPrompt = agentConfig?.system_prompt || "Eres Luxia IA, el auditor inteligente de Luxia.";
    const modelName = agentConfig?.model_name || 'gemini-3.5-flash';
    const temperature = agentConfig?.temperature ? parseFloat(agentConfig.temperature) : 0.2;
    const maxTokens = agentConfig?.max_output_tokens ? parseInt(agentConfig.max_output_tokens) : 1000;

    const systemInstruction = `${systemPrompt}\n\nREGLA ABSOLUTA DE FORMATO:\nResponde EXCLUSIVAMENTE con un objeto JSON válido. Sin markdown, sin explicaciones introductorias. Si no puedes calcular un valor, usa null.`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction,
        temperature,
        maxOutputTokens: maxTokens,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const outputText = response.text || "";

    // Parsear respuesta JSON
    let parsedJson = null;
    try {
      const cleanJson = outputText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      parsedJson = JSON.parse(cleanJson);
    } catch {
      parsedJson = { raw: outputText };
    }

    // Registrar telemetría de consumo en logs_ia_consumo
    const inputTokens = response.usageMetadata?.promptTokenCount || 0;
    const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;
    const totalTokens = inputTokens + outputTokens;
    const estimatedCost = (inputTokens * 0.0000001) + (outputTokens * 0.0000004);

    await supabase.from('logs_ia_consumo').insert({
      user_email: userEmail,
      cliente_id: contextInfo.clienteId || null,
      lead_id: contextInfo.leadId || null,
      oportunidad_id: contextInfo.oportunidadId || null,
      model_name: modelName,
      type: `agente_${agenteId}`,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      cost_usd: estimatedCost
    });

    return {
      success: true,
      text: outputText,
      data: parsedJson,
      tokens: totalTokens
    };
  } catch (err) {
    console.error(`[LUXIA IA] Error ejecutando agente ${agenteId}:`, err);
    return {
      success: false,
      error: err.message
    };
  }
}

module.exports = {
  generateLuxiaContent,
  getAiClient
};
