import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, query, limit, addDoc } from 'firebase/firestore';

// 1. Load config from .env.local
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

// WhatsApp rates based on Meta conversation pricing per country/category
const WHATSAPP_RATES = {
  AR: { marketing: 0.063, utility: 0.035, service: 0.020 },
  CL: { marketing: 0.068, utility: 0.038, service: 0.025 },
  CO: { marketing: 0.025, utility: 0.015, service: 0.010 },
  PE: { marketing: 0.061, utility: 0.032, service: 0.020 },
  MX: { marketing: 0.043, utility: 0.025, service: 0.015 },
  DEFAULT: { marketing: 0.050, utility: 0.030, service: 0.015 }
};

const COUNTRIES = [
  { code: 'AR', prefix: '+54' },
  { code: 'CL', prefix: '+56' },
  { code: 'CO', prefix: '+57' },
  { code: 'PE', prefix: '+51' },
  { code: 'MX', prefix: '+52' }
];

const CATEGORIES = ['marketing', 'utility', 'service'];

async function run() {
  try {
    // 2. Fetch some clients and users to assign logs realistically
    console.log('Obteniendo clientes y usuarios para asociar...');
    const clientesSnap = await getDocs(query(collection(db, 'clientes'), limit(5)));
    const usuariosSnap = await getDocs(query(collection(db, 'usuarios'), limit(5)));

    const clientIds = [];
    clientesSnap.forEach(d => clientIds.push(d.id));
    if (clientIds.length === 0) {
      clientIds.push('local_test_client_1', 'local_test_client_2');
    }

    const userEmails = [];
    usuariosSnap.forEach(d => userEmails.push(d.id));
    if (userEmails.length === 0) {
      userEmails.push('admin@luxia.com', 'comercial@luxia.com');
    }

    // 3. Generate mock consumption logs
    console.log('Generando 60 logs de consumo de WhatsApp...');
    let totalMockCost = 0;

    for (let i = 0; i < 60; i++) {
      const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
      const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
      const rates = WHATSAPP_RATES[country.code];
      const cost = rates[category];
      totalMockCost += cost;

      // Distribute logs over the last 30 days
      const daysAgo = Math.floor(Math.random() * 30);
      const logDate = new Date();
      logDate.setDate(logDate.getDate() - daysAgo);

      const log = {
        clienteId: clientIds[Math.floor(Math.random() * clientIds.length)],
        usuarioEmail: userEmails[Math.floor(Math.random() * userEmails.length)],
        tipoConversacion: category,
        costoUsd: cost,
        pais: country.code,
        destino: `${country.prefix}9${Math.floor(10000000 + Math.random() * 90000000)}`,
        timestamp: logDate.toISOString()
      };

      await addDoc(collection(db, 'logs_whatsapp_consumo'), log);
    }

    // 4. Generate some mock error logs
    console.log('Generando logs de errores de WhatsApp...');
    const errors = [
      '131030: User has not opted in to receive templates',
      '131026: Message template does not exist in selected language',
      '131042: Payment required - Billing issue on Business Manager',
      '131009: Parameter count mismatch in template payload',
      '131051: Recipient phone number is not registered on WhatsApp'
    ];

    for (let i = 0; i < 8; i++) {
      const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
      const daysAgo = Math.floor(Math.random() * 15);
      const logDate = new Date();
      logDate.setDate(logDate.getDate() - daysAgo);

      const errorLog = {
        timestamp: logDate.toISOString(),
        error: errors[Math.floor(Math.random() * errors.length)],
        destino: `${country.prefix}9${Math.floor(10000000 + Math.random() * 90000000)}`
      };

      await addDoc(collection(db, 'logs_whatsapp_errores'), errorLog);
    }

    // 5. Create default budget config document
    console.log('Estableciendo configuración de presupuesto de WhatsApp...');
    const configRef = doc(db, 'config_general', 'whatsapp_usage');
    await setDoc(configRef, {
      limitMonthlyUsd: 150.0,
      accumulatedCostUsd: parseFloat(totalMockCost.toFixed(3)),
      disabledByBudget: false,
      alertThresholdPercent: 80,
      lastAlertSent: 'none'
    });

    console.log(`\x1b[32m[SEEDED] Poblado con éxito en Firestore. Costo total acumulado: $${totalMockCost.toFixed(2)} USD.\x1b[0m`);
  } catch (err) {
    console.error('Error al poblar la base de datos:', err);
  }
}

run();
