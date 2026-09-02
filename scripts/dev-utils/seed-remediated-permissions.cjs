const admin = require('../../functions/node_modules/firebase-admin');
const serviceAccount = require('../../functions/firebase-service-account-dev.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {
  console.log("Iniciando inyección de nuevos roles/permisos dinámicos en Firestore...");
  const docRef = db.collection('config_permisos').doc('rol_matrix');
  const snap = await docRef.get();
  
  if (!snap.exists) {
    console.log("No se encontró el documento rol_matrix en Firestore.");
    return;
  }
  
  const data = snap.data();
  if (!data.views) data.views = {};
  if (!data.actions) data.actions = {};
  
  const newViews = {
    infraestructura: ['superadmin'],
    alertas_sistema: ['superadmin'],
    dashboard_adopcion: ['lector', 'agente', 'supervisor', 'admin', 'superadmin'],
    monitoreo_presencia: ['agente', 'supervisor', 'admin', 'superadmin']
  };
  
  const newActions = {
    asignar_responsable_comercial: ['admin', 'superadmin'],
    forzar_fase_comercial: ['admin', 'superadmin'],
    editar_estado_presencia: ['supervisor', 'admin', 'superadmin'],
    promover_superadmin: ['superadmin'],
    configurar_copiloto: ['agente', 'supervisor', 'admin', 'superadmin'],
    adicionar_adenda_renovacion: ['supervisor', 'admin', 'superadmin'],
    operar_tarea_crm: ['agente', 'supervisor', 'admin', 'superadmin']
  };
  
  let changed = false;
  
  Object.entries(newViews).forEach(([key, val]) => {
    if (!data.views[key]) {
      data.views[key] = val;
      console.log(`Poblada vista: views.${key} = [${val.join(', ')}]`);
      changed = true;
    }
  });
  
  Object.entries(newActions).forEach(([key, val]) => {
    if (!data.actions[key]) {
      data.actions[key] = val;
      console.log(`Poblada acción: actions.${key} = [${val.join(', ')}]`);
      changed = true;
    }
  });
  
  if (changed) {
    await docRef.set(data);
    console.log("Inyección completada. Documento rol_matrix actualizado.");
  } else {
    console.log("No se requirieron cambios. Las llaves ya están presentes en Firestore.");
  }
}

run().catch(err => {
  console.error("Error al inyectar permisos:", err);
  process.exit(1);
});
