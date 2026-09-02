const admin = require('../../functions/node_modules/firebase-admin');
const serviceAccount = require('../../functions/firebase-service-account-dev.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {
  console.log("Iniciando inyección de ámbitos de datos (Data Scopes) y permisos granulares en Firestore...");
  const docRef = db.collection('config_permisos').doc('rol_matrix');
  const snap = await docRef.get();
  
  if (!snap.exists) {
    console.log("No se encontró el documento rol_matrix en Firestore.");
    return;
  }
  
  const data = snap.data();
  if (!data.views) data.views = {};
  if (!data.actions) data.actions = {};
  if (!data.scopes) data.scopes = {};
  
  const newViews = {
    referencia_tecnica: ['superadmin', 'admin'],
    configuracion_pipeline: ['superadmin', 'admin'],
    configuracion_onboarding: ['superadmin', 'admin'],
    configuracion_servicios: ['superadmin', 'admin'],
    configuracion_negocio: ['superadmin', 'admin', 'lector'],
    configuracion_usuarios: ['superadmin', 'admin'],
    configuracion_equipos: ['superadmin', 'admin'],
    configuracion_capacitacion: ['superadmin', 'admin'],
    configuracion_metrics_studio: ['superadmin', 'admin'],
    configuracion_integraciones: ['superadmin', 'admin']
  };
  
  const newActions = {
    operar_onboarding_checklist: ['agente', 'supervisor', 'admin', 'superadmin']
  };

  const defaultScopes = {
    leads: {
      superadmin: 'ALL',
      admin: 'ALL',
      supervisor: 'TEAM',
      agente: 'OWN',
      lector: 'ALL'
    },
    oportunidades: {
      superadmin: 'ALL',
      admin: 'ALL',
      supervisor: 'TEAM',
      agente: 'OWN',
      lector: 'ALL'
    },
    clientes: {
      superadmin: 'ALL',
      admin: 'ALL',
      supervisor: 'TEAM',
      agente: 'OWN',
      lector: 'ALL'
    },
    tablero: {
      superadmin: 'ALL',
      admin: 'ALL',
      supervisor: 'TEAM',
      agente: 'OWN',
      lector: 'ALL'
    },
    alertas: {
      superadmin: 'ALL',
      admin: 'ALL',
      supervisor: 'TEAM',
      agente: 'OWN',
      lector: 'ALL'
    },
    capacitacion: {
      superadmin: 'ALL',
      admin: 'ALL',
      supervisor: 'TEAM',
      agente: 'OWN',
      lector: 'ALL'
    },
    consumo_ia: {
      superadmin: 'ALL',
      admin: 'ALL',
      supervisor: 'TEAM',
      agente: 'OWN',
      lector: 'ALL'
    }
  };

  let changed = false;
  
  // 1. Inyectar Vistas
  Object.entries(newViews).forEach(([key, val]) => {
    if (!data.views[key]) {
      data.views[key] = val;
      console.log(`Poblada vista: views.${key} = [${val.join(', ')}]`);
      changed = true;
    }
  });
  
  // 2. Inyectar Acciones
  Object.entries(newActions).forEach(([key, val]) => {
    if (!data.actions[key]) {
      data.actions[key] = val;
      console.log(`Poblada acción: actions.${key} = [${val.join(', ')}]`);
      changed = true;
    }
  });

  // 3. Inyectar Scopes
  Object.entries(defaultScopes).forEach(([entity, scopeMapping]) => {
    if (!data.scopes[entity]) {
      data.scopes[entity] = scopeMapping;
      console.log(`Poblado scope para la entidad: ${entity}`);
      changed = true;
    }
  });
  
  if (changed) {
    await docRef.set(data);
    console.log("Inyección completada. Documento rol_matrix actualizado.");
  } else {
    console.log("No se requirieron cambios. Todos los scopes y permisos ya están presentes.");
  }
}

run().catch(err => {
  console.error("Error al inyectar scopes y permisos:", err);
  process.exit(1);
});
