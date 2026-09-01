#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const admin = require('../functions/node_modules/firebase-admin');

const serviceAccountPath = path.resolve(__dirname, '../firebase-service-account-dev.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error("No service account found");
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function inspectExams() {
  const snap = await db.collection('config_capacitacion_examenes').get();
  console.log(`Encontrados ${snap.size} exámenes configurados en Firestore:\n`);

  snap.forEach(docSnap => {
    console.log(`=== EXAMEN ID: ${docSnap.id} ===`);
    const data = docSnap.data();
    console.log(`Rol: ${data.rol} | Dificultad: ${data.dificultad}`);
    console.log(`Total Preguntas Teóricas: ${data.teorico ? data.teorico.length : 0}`);
    if (data.teorico && data.teorico.length > 0) {
      data.teorico.forEach((q, idx) => {
        console.log(`  [P${idx + 1}] ID: ${q.id} | Pregunta: ${q.pregunta}`);
        if (q.opciones) {
          q.opciones.forEach((opt, oIdx) => {
            const isCorrect = oIdx === q.correcta ? ' (CORRECTA)' : '';
            console.log(`     - (${oIdx}) ${opt}${isCorrect}`);
          });
        }
      });
    }
    if (data.practico) {
      console.log(`  [Práctico] Pregunta: ${data.practico.pregunta}`);
      console.log(`  [Práctico] Criterios: ${JSON.stringify(data.practico.criteriosEvaluacion || [])}`);
    }
    console.log('\n');
  });

  process.exit(0);
}

inspectExams().catch(err => {
  console.error(err);
  process.exit(1);
});
