#!/usr/bin/env node
/**
 * build-rag-embeddings.cjs
 * 
 * Genera fragmentos (chunks) de los manuales de operaciones y referencia técnica,
 * calcula sus embeddings usando text-embedding-004 de Google Gemini, y los guarda
 * en la colección /documentacion_embeddings en Firestore (crm-luxia-dev).
 * 
 * Uso: node scripts/build-rag-embeddings.cjs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const admin = require('../functions/node_modules/firebase-admin');

// Intentar cargar la API key del entorno o del CLI de Firebase
let apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  try {
    apiKey = execSync('firebase functions:secrets:access GEMINI_API_KEY --project crm-luxia-dev', { encoding: 'utf8' }).trim();
    process.env.GEMINI_API_KEY = apiKey;
  } catch (err) {
    console.warn("⚠️ No se pudo obtener GEMINI_API_KEY del Firebase CLI. Asegúrate de definirla si falla la generación.");
  }
}

if (!apiKey) {
  console.error("❌ Error: Falta la variable de entorno GEMINI_API_KEY.");
  console.log("Corre el script con: GEMINI_API_KEY=tu_api_key node scripts/build-rag-embeddings.cjs");
  process.exit(1);
}

const { GoogleGenAI } = require('../functions/node_modules/@google/genai');

const serviceAccountPath = path.resolve(__dirname, '../firebase-service-account-dev.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ No se encontró firebase-service-account-dev.json en la raíz del proyecto.");
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();
const ai = new GoogleGenAI({ apiKey });

// Función de Chunking con solapamiento (overlap)
function chunkText(text, sourceDoc, sourceSectionId, maxLength = 1000, overlap = 200) {
  if (!text) return [];
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = start + maxLength;
    if (end < text.length) {
      // Intentar alinear el corte al último espacio para no cortar palabras
      const lastSpace = text.lastIndexOf(' ', end);
      if (lastSpace > start + maxLength - overlap) {
        end = lastSpace;
      }
    }
    const chunkContent = text.substring(start, end).trim();
    if (chunkContent) {
      chunks.push({
        text: chunkContent,
        sourceDoc,
        sourceSectionId
      });
    }
    start = end - overlap;
    if (start >= text.length - overlap) break;
  }
  return chunks;
}

async function run() {
  console.log("🚀 Iniciando extracción de manuales desde Firestore...");

  const allChunks = [];

  // 1. Obtener secciones de manual_operaciones
  try {
    const opsSnap = await db.collection("documentacion_maestra")
      .doc("manual_operaciones")
      .collection("secciones")
      .orderBy("orden")
      .get();
    
    opsSnap.forEach(d => {
      const data = d.data();
      const content = data.contenido || "";
      const chunks = chunkText(content, "manual_operaciones", d.id);
      allChunks.push(...chunks);
    });
    console.log(`📌 Se generaron ${allChunks.length} fragmentos de manual_operaciones.`);
  } catch (err) {
    console.error("❌ Error cargando manual_operaciones:", err);
  }

  // 2. Obtener secciones de referencia_tecnica
  const initialOpsCount = allChunks.length;
  try {
    const techSnap = await db.collection("documentacion_maestra")
      .doc("referencia_tecnica")
      .collection("secciones")
      .orderBy("orden")
      .get();
    
    techSnap.forEach(d => {
      const data = d.data();
      const content = data.contenido || "";
      const chunks = chunkText(content, "referencia_tecnica", d.id);
      allChunks.push(...chunks);
    });
    console.log(`📌 Se generaron ${allChunks.length - initialOpsCount} fragmentos de referencia_tecnica.`);
  } catch (err) {
    console.error("❌ Error cargando referencia_tecnica:", err);
  }

  console.log(`Total de fragmentos a indexar: ${allChunks.length}. Generando embeddings...`);

  // 3. Generar embeddings y guardar en lote (batch) en Firestore
  const batch = db.batch();
  
  // Limpiar base de conocimiento previa
  const oldDocs = await db.collection("documentacion_embeddings").get();
  oldDocs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  console.log("🧹 Base de conocimiento de embeddings previa eliminada.");

  // Generar embeddings para cada chunk
  for (let i = 0; i < allChunks.length; i++) {
    const chunk = allChunks[i];
    console.log(`  [${i + 1}/${allChunks.length}] Procesando fragmento de ${chunk.sourceDoc} - ${chunk.sourceSectionId}...`);
    
    try {
      // Evitar tocar cuotas y límites de velocidad de Gemini API
      await new Promise(resolve => setTimeout(resolve, 250));

      const response = await ai.models.embedContent({
        model: "gemini-embedding-2",
        contents: chunk.text
      });

      const embeddingValues = response?.embedding?.values || response?.embeddings?.[0]?.values;

      if (embeddingValues) {
        chunk.embedding = embeddingValues;
      } else {
        console.error(`❌ La API de Gemini no retornó un vector válido para el fragmento ${i}. Respuesta:`, response);
      }
    } catch (apiErr) {
      console.error(`❌ Error generando embedding para fragmento ${i}:`, apiErr);
    }
  }

  console.log("💾 Guardando embeddings en Firestore en lotes de 20 para evitar límites de red...");
  const validChunks = allChunks.filter(c => c.embedding);
  const batchSize = 20;

  for (let i = 0; i < validChunks.length; i += batchSize) {
    const commitBatch = db.batch();
    const chunkSlice = validChunks.slice(i, i + batchSize);

    chunkSlice.forEach((chunk, index) => {
      const globalIdx = i + index;
      const docRef = db.collection("documentacion_embeddings").doc(`chunk_${globalIdx}`);
      commitBatch.set(docRef, {
        id: `chunk_${globalIdx}`,
        text: chunk.text,
        sourceDoc: chunk.sourceDoc,
        sourceSectionId: chunk.sourceSectionId,
        embedding: chunk.embedding,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    console.log(`  💾 Confirmando lote de fragmentos ${i + 1} a ${Math.min(i + batchSize, validChunks.length)}...`);
    await commitBatch.commit();
  }

  console.log("✅ Proceso de sembrado RAG finalizado con éxito.");
  process.exit(0);
}

run().catch(err => {
  console.error("❌ Error crítico en ejecución:", err);
  process.exit(1);
});
