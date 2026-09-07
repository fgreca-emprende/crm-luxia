/**
 * Script de siembra oficial para exámenes de auto-capacitación en Supabase.
 * Carga las preguntas y casos prácticos oficiales depurados (sin CX, Slack, Gamificación ni Firestore).
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (m) {
      const k = m[1];
      let v = (m[2] || '').trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      process.env[k] = v;
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://192.168.0.70:8000';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('❌ Falta SUPABASE_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedExams() {
  const dataPath = path.resolve(__dirname, 'data/exams_clean.json');
  if (!fs.existsSync(dataPath)) {
    console.error('❌ Archivo de datos no encontrado:', dataPath);
    process.exit(1);
  }

  const exams = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  console.log(`🚀 Sembrando ${exams.length} exámenes oficiales en config_capacitacion_examenes...`);

  for (const ex of exams) {
    const payload = {
      id: ex.id,
      rol: ex.rol,
      dificultad: ex.dificultad,
      titulo: ex.titulo,
      descripcion: ex.descripcion,
      teorico: ex.teorico,
      practico: ex.practico,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('config_capacitacion_examenes')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.error(`❌ Error al sembrar examen ${ex.id}:`, error.message);
    } else {
      console.log(`✅ Examen ${ex.id} (${ex.rol} / ${ex.dificultad}) sincronizado correctamente.`);
    }
  }

  console.log('✨ Proceso de siembra de exámenes completado con éxito.');
}

seedExams().catch(console.error);
