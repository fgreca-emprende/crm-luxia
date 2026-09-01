const admin = require('../../functions/node_modules/firebase-admin');
const serviceAccount = require('../../functions/firebase-service-account-dev.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {
  console.log("Iniciando limpieza de permisos obsoletos...");
  const docRef = db.collection('config_permisos').doc('rol_matrix');
  const snap = await docRef.get();
  
  if (!snap.exists) {
    console.log("No se encontró el documento rol_matrix en Firestore.");
    return;
  }
  
  const data = snap.data();
  console.log("Campos actuales en actions:", Object.keys(data.actions || {}));
  
  let changed = false;
  
  if (data.actions) {
    const obsoleteKeys = ['exportar_datos', 'eliminar_lead_oportunidad', 'operar_ticket', 'configurar_slas', 'auditar_cx', 'configurar_canales'];
    obsoleteKeys.forEach(key => {
      if (key in data.actions) {
        delete data.actions[key];
        console.log(`Eliminado permiso obsoleto '${key}' de config_permisos/rol_matrix`);
        changed = true;
      }
    });
  }
  
  if (changed) {
    await docRef.set(data);
    console.log("Documento config_permisos/rol_matrix actualizado con éxito.");
  } else {
    console.log("No se requirieron cambios en config_permisos/rol_matrix.");
  }
}

run().catch(err => {
  console.error("Error ejecutando limpieza:", err);
  process.exit(1);
});
