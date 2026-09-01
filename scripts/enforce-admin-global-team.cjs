#!/usr/bin/env node
/**
 * enforce-admin-global-team.cjs
 * 
 * Script de auditoría y migración que escanea las colecciones /usuarios e /invitaciones.
 * Para cualquier documento donde 'rol' sea 'admin' o 'superadmin' y 'equipo' sea diferente de 'Global',
 * actualiza 'equipo: Global' de forma estricta.
 * 
 * Ejecución: node scripts/enforce-admin-global-team.cjs
 */

const fs = require('fs');
const path = require('path');
const admin = require('../functions/node_modules/firebase-admin');

const args = process.argv.slice(2);
const isProd = args.includes('--prod') || args.includes('production');
const serviceAccountFile = isProd ? 'firebase-service-account.json' : 'firebase-service-account-dev.json';
const serviceAccountPath = path.resolve(__dirname, `../${serviceAccountFile}`);

console.log(`Inicializando Firebase Admin SDK para auditoría en modo: ${isProd ? 'PRODUCCIÓN' : 'DESARROLLO'}`);
console.log(`Usando credenciales de: ${serviceAccountFile}`);

if (!fs.existsSync(serviceAccountPath)) {
  console.error("No se encontró el archivo de cuenta de servicio en:", serviceAccountPath);
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function runEnforce() {
  let updatedUsersCount = 0;
  let updatedInvsCount = 0;

  console.log("\n1. Auditando colección /usuarios...");
  const usersSnap = await db.collection('usuarios').get();
  for (const userDoc of usersSnap.docs) {
    const uData = userDoc.data();
    const role = (uData.rol || '').toLowerCase();
    const equipo = uData.equipo || '';

    if (['admin', 'superadmin'].includes(role) && equipo !== 'Global') {
      console.log(`  -> Actualizando Usuario [${userDoc.id}] (${uData.email || 'sin email'}): Rol='${role}' | Equipo viejo='${equipo}' => Nuevo equipo='Global'`);
      await userDoc.ref.update({ equipo: 'Global' });
      updatedUsersCount++;
    }
  }

  console.log("\n2. Auditando colección /invitaciones...");
  const invsSnap = await db.collection('invitaciones').get();
  for (const invDoc of invsSnap.docs) {
    const iData = invDoc.data();
    const role = (iData.rol || '').toLowerCase();
    const equipo = iData.equipo || '';

    if (['admin', 'superadmin'].includes(role) && equipo !== 'Global') {
      console.log(`  -> Actualizando Invitación [${invDoc.id}] (${iData.email || 'sin email'}): Rol='${role}' | Equipo viejo='${equipo}' => Nuevo equipo='Global'`);
      await invDoc.ref.update({ equipo: 'Global' });
      updatedInvsCount++;
    }
  }

  console.log(`\n¡Auditoría y migración de equipos completada!`);
  console.log(`- Usuarios de administración corregidos a Global: ${updatedUsersCount}`);
  console.log(`- Invitaciones de administración corregidas a Global: ${updatedInvsCount}`);

  process.exit(0);
}

runEnforce().catch(err => {
  console.error("Error durante la auditoría de equipos:", err);
  process.exit(1);
});
