#!/usr/bin/env node
/**
 * seed-ia-models.cjs
 * 
 * Popula y actualiza la colección /config_ia_modelos en Firestore (crm-luxia-dev)
 * con la serie oficial de modelos Gemini 3.x (gemini-3.5-flash-lite, gemini-3.5-flash, gemini-3.6-flash).
 * 
 * Uso: node scripts/seed-ia-models.cjs
 */

const fs = require('fs');
const path = require('path');
const admin = require('../functions/node_modules/firebase-admin');

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

const OFFICIAL_MODELS = [
  {
    id: 'gemini-3.5-flash-lite',
    nombre: 'Gemini 3.5 Flash Lite',
    proveedor: 'Google Gemini',
    estado: 'activo',
    esDefault: true,
    descripcion: 'Ultrarrápido, ligero y de respuesta instantánea optimizado para tareas de alta frecuencia y soporte técnico.',
    officialInputRatePer1M: 0.075,
    officialOutputRatePer1M: 0.30,
    agreedInputRatePer1M: null,
    agreedOutputRatePer1M: null,
    tieneAcuerdo: false,
    maxOutputTokens: 8192,
    contextWindow: 1048576,
    lastPriceSync: new Date().toISOString(),
    sourceUrl: 'https://ai.google.dev/pricing'
  },
  {
    id: 'gemini-3.5-flash',
    nombre: 'Gemini 3.5 Flash',
    proveedor: 'Google Gemini',
    estado: 'activo',
    esDefault: false,
    descripcion: 'Modelo principal multitarea de velocidad y equilibrio ideal para agentes de producción.',
    officialInputRatePer1M: 0.10,
    officialOutputRatePer1M: 0.40,
    agreedInputRatePer1M: null,
    agreedOutputRatePer1M: null,
    tieneAcuerdo: false,
    maxOutputTokens: 8192,
    contextWindow: 1048576,
    lastPriceSync: new Date().toISOString(),
    sourceUrl: 'https://ai.google.dev/pricing'
  },
  {
    id: 'gemini-3.6-flash',
    nombre: 'Gemini 3.6 Flash',
    proveedor: 'Google Gemini',
    estado: 'activo',
    esDefault: false,
    descripcion: 'Modelo de última generación con razonamiento avanzado, alta velocidad y capacidad multimodal profunda.',
    officialInputRatePer1M: 0.15,
    officialOutputRatePer1M: 0.60,
    agreedInputRatePer1M: null,
    agreedOutputRatePer1M: null,
    tieneAcuerdo: false,
    maxOutputTokens: 8192,
    contextWindow: 2097152,
    lastPriceSync: new Date().toISOString(),
    sourceUrl: 'https://ai.google.dev/pricing'
  }
];

async function seedModels() {
  console.log("🚀 Limpiando modelos antiguos y sembrando la serie Gemini 3.x en /config_ia_modelos...");
  const batch = db.batch();

  // 1. Eliminar de Firestore cualquier modelo que no pertenezca a la serie 3.x requerida
  const snap = await db.collection('config_ia_modelos').get();
  snap.forEach(docSnap => {
    const id = docSnap.id;
    if (!OFFICIAL_MODELS.some(m => m.id === id)) {
      console.log(`⚠️ Eliminando modelo antiguo de Firestore: ${id}`);
      batch.delete(docSnap.ref);
    }
  });

  // 2. Guardar los 3 modelos requeridos de la serie Gemini 3.x
  OFFICIAL_MODELS.forEach(m => {
    const docRef = db.collection('config_ia_modelos').doc(m.id);
    console.log(`  └─ Guardando modelo: ${m.id} (${m.nombre}) - Input: $${m.officialInputRatePer1M}/1M | Output: $${m.officialOutputRatePer1M}/1M`);
    batch.set(docRef, {
      ...m,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });

  await batch.commit();
  console.log("✅ Proceso completado exitosamente. La colección /config_ia_modelos tiene únicamente Gemini 3.5 Flash Lite, 3.5 Flash y 3.6 Flash.");
  process.exit(0);
}

seedModels().catch(err => {
  console.error("❌ Error ejecutando el sembrado de modelos en Firestore:", err);
  process.exit(1);
});
