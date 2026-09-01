import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the project ID being deployed to from environment variable
// Fallback to calling `firebase use` if run manually
let targetProjectId = process.env.GCLOUD_PROJECT;

if (!targetProjectId) {
  try {
    const { execSync } = await import('child_process');
    targetProjectId = execSync('npx firebase use', { encoding: 'utf8' }).trim();
    // If it returns an alias (e.g. "development"), map it using .firebaserc
    if (targetProjectId === 'development') {
      targetProjectId = 'crm-luxia-dev';
    } else if (targetProjectId === 'production') {
      targetProjectId = 'crm-luxia-enterprise';
    }
  } catch (err) {
    console.error('No se pudo determinar el proyecto activo de Firebase.');
    process.exit(1);
  }
}

console.log(`[Verificación] Validando build para el proyecto destino: ${targetProjectId}`);

// Define what string we expect and what we don't expect
let expectedString = '';
let forbiddenString = '';

if (targetProjectId === 'crm-luxia-dev') {
  expectedString = 'crm-luxia-dev';
  forbiddenString = 'crm-luxia-enterprise';
} else if (targetProjectId === 'crm-luxia-enterprise') {
  expectedString = 'crm-luxia-enterprise';
  forbiddenString = 'crm-luxia-dev';
} else {
  console.error(`Proyecto destino no reconocido: ${targetProjectId}`);
  process.exit(1);
}

// Scan dist/assets
const assetsDir = path.join(__dirname, '../dist/assets');
if (!fs.existsSync(assetsDir)) {
  console.error('La carpeta dist/assets no existe. ¿Compilaste el proyecto primero?');
  process.exit(1);
}

const files = fs.readdirSync(assetsDir);
const jsFiles = files.filter(f => f.endsWith('.js'));

let foundExpected = false;
let foundForbidden = false;
let forbiddenFile = '';

for (const file of jsFiles) {
  const content = fs.readFileSync(path.join(assetsDir, file), 'utf8');
  if (content.includes(expectedString)) {
    foundExpected = true;
  }
  if (content.includes(forbiddenString)) {
    foundForbidden = true;
    forbiddenFile = file;
    break;
  }
}

if (foundForbidden) {
  console.error(`\x1b[31m[ERROR] ¡Credenciales mezcladas detectadas!`);
  console.error(`Estás intentando desplegar a "${targetProjectId}" pero el build contiene referencias a "${forbiddenString}" (encontrado en ${forbiddenFile}).`);
  console.error(`Por favor, compila con el comando correcto antes de desplegar:\n`);
  if (targetProjectId === 'crm-luxia-dev') {
    console.error(`  npm run build:dev && firebase deploy --only hosting\x1b[0m\n`);
  } else {
    console.error(`  npm run build && firebase deploy --only hosting\x1b[0m\n`);
  }
  process.exit(1);
}

if (!foundExpected) {
  console.warn(`\x1b[33m[ADVERTENCIA] No se encontró la cadena "${expectedString}" en los archivos JS compilados. Asegúrate de que las variables de entorno se cargaron correctamente.\x1b[0m`);
} else {
  console.log(`\x1b[32m[OK] Verificación exitosa. Las credenciales en el build coinciden con el entorno "${targetProjectId}".\x1b[0m`);
}
