import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, doc, setDoc, query, limit, Timestamp } from 'firebase/firestore';

// 1. Cargar configuración desde .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        envConfig[key] = val;
      }
    }
  });
}

const firebaseConfig = {
  apiKey: envConfig.VITE_FIREBASE_API_KEY,
  authDomain: envConfig.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: envConfig.VITE_FIREBASE_PROJECT_ID,
  storageBucket: envConfig.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envConfig.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: envConfig.VITE_FIREBASE_APP_ID
};

console.log('Inicializando Firebase con Project ID:', firebaseConfig.projectId);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  try {
    // 2. Obtener clientes para asociar
    console.log('Obteniendo clientes de la base de datos...');
    const clientesSnap = await getDocs(query(collection(db, 'clientes'), limit(3)));
    let clientes = [];
    clientesSnap.forEach(d => {
      clientes.push({ id: d.id, ...d.data() });
    });

    let clienteId = '';
    let nombreEmpresa = '';
    let pais = 'AR';

    if (clientes.length === 0) {
      console.log('No hay clientes en la base de datos. Creando un cliente de pruebas...');
      const mockClientRef = doc(collection(db, 'clientes'));
      clienteId = mockClientRef.id;
      nombreEmpresa = 'Playwright QA Company';
      pais = 'AR';
      await setDoc(mockClientRef, {
        nombreEmpresa,
        estado: 'Activo',
        pais,
        comercialEmail: 'comercial@luxia.com',
        comercialNombre: 'Comercial Luxia',
        fechaIngreso: Timestamp.fromDate(new Date()),
        creadaEn: Timestamp.fromDate(new Date())
      });
      console.log('Cliente de prueba creado:', clienteId);
    } else {
      clienteId = clientes[0].id;
      nombreEmpresa = clientes[0].nombreEmpresa || 'Cliente de Pruebas';
      pais = clientes[0].pais || 'AR';
      console.log(`Usando cliente existente: ${nombreEmpresa} (${clienteId})`);
    }

    // Asegurar que exista al menos el usuario comercial@luxia.com y legal@luxia.com en 'usuarios'
    console.log('Asegurando usuarios de prueba en la colección usuarios...');
    await setDoc(doc(db, 'usuarios', 'comercial@luxia.com'), {
      nombre: 'Comercial Luxia',
      rol: 'usuario',
      equipo: 'Adquisicion'
    }, { merge: true });

    await setDoc(doc(db, 'usuarios', 'legal@luxia.com'), {
      nombre: 'Legal Luxia',
      rol: 'lector',
      equipo: 'Global'
    }, { merge: true });

    console.log('Eliminando actividades CRM previas de prueba...');
    const actPrevSnap = await getDocs(collection(db, 'crm_actividades'));
    // Omitir borrado masivo real por seguridad si hay muchos, pero limpiar los de pruebas si se desea
    console.log(`Encontradas ${actPrevSnap.size} actividades en total.`);    // 3. Crear actividades de prueba
    console.log('Creando actividades de prueba...');

    const ahora = new Date();

    // Actividad 3: Completada (Done)
    const fechaAct3 = new Date(ahora);
    fechaAct3.setDate(ahora.getDate() - 3);

    const act3 = {
      titulo: 'Firma y digitalización de Acuerdo Marco',
      descripcion: 'Firmar contrato base que habilita el resto de los anexos.',
      estado: 'done',
      clienteId,
      nombreEmpresa,
      pais,
      responsableEmail: 'legal@luxia.com',
      fechaFin: Timestamp.fromDate(fechaAct3),
      alertaConfig: { diasPrevios: 3, alertaGenerada: false },
      adjuntos: [
        { nombre: 'Acuerdo Marco Escaneado', url: 'https://drive.google.com/open?id=mock_id', tipo: 'link' }
      ],
      tareas: [
        {
          id: 't3_1',
          titulo: 'Control legal de firmas',
          completada: true,
          responsableEmail: 'legal@luxia.com',
          fechaFin: Timestamp.fromDate(fechaAct3),
          alertaConfig: { diasPrevios: 1, alertaGenerada: false },
          adjuntos: []
        }
      ],
      creadaEn: Timestamp.fromDate(ahora),
      creadaPor: 'legal@luxia.com'
    };

    const doc3 = await addDoc(collection(db, 'crm_actividades'), act3);

    console.log('Actividades creadas exitosamente con IDs:');
    console.log('- Actividad 3 (Done):', doc3.id);
    console.log('Semillero finalizado con éxito.');

  } catch (error) {
    console.error('Error durante la siembra de datos:', error);
  }
}

run();
