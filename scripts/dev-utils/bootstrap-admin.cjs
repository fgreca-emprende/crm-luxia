const admin = require('firebase-admin');

// Ensure you have set the GOOGLE_APPLICATION_CREDENTIALS env var or run this with appropriate IAM permissions
// e.g. export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"

admin.initializeApp();

const db = admin.firestore();

async function bootstrap() {
  console.log("Iniciando migración de roles a Custom Claims...");
  try {
    const snapshot = await db.collection('usuarios').get();
    let count = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const email = data.email || doc.id;
      const rol = data.rol ? data.rol.toLowerCase() : '';

      if (['admin', 'superadmin'].includes(rol)) {
        try {
          const userRecord = await admin.auth().getUserByEmail(email);
          await admin.auth().setCustomUserClaims(userRecord.uid, { role: rol });
          console.log(`✅ Claim '${rol}' asignado a ${email}`);
          count++;
        } catch (authErr) {
          if (authErr.code === 'auth/user-not-found') {
            console.log(`⚠️  Usuario no encontrado en Auth, pero está en Firestore: ${email}`);
          } else {
            console.error(`❌ Error asignando claim a ${email}:`, authErr.message);
          }
        }
      } else if (rol === 'lector') {
        try {
          const userRecord = await admin.auth().getUserByEmail(email);
          await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'lector' });
          console.log(`✅ Claim 'lector' asignado a ${email}`);
          count++;
        } catch (authErr) {
           if (authErr.code === 'auth/user-not-found') {
            console.log(`⚠️  Usuario no encontrado en Auth, pero está en Firestore: ${email}`);
          } else {
            console.error(`❌ Error asignando claim a ${email}:`, authErr.message);
          }
        }
      }
    }
    console.log(`\n🎉 Migración completada. Se asignaron claims a ${count} usuarios.`);
  } catch (error) {
    console.error("Error durante el bootstrap:", error);
  }
}

bootstrap();
