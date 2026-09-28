// Lógica compartida por prisma/seed-horarios-software.js y
// prisma/seed-horarios-completo.js. No se ejecuta directamente: cada uno de
// esos dos scripts importa `runSeedHorarios(DATA)` y le pasa su propio bloque
// de datos (extraído del PDF de horarios FISEI, periodo JULIO-DICIEMBRE 2026).
//
// Es defensivo/idempotente: antes de crear cada fila revisa si ya existe algo
// equivalente (por nombre, o por cédula/correo para Usuario) y si es así lo
// reutiliza en vez de duplicar. Se puede correr varias veces sin problema.

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { enlazarHorariosConParalelos } = require('./enlazar-horarios-paralelos');

const prisma = new PrismaClient();
const PASSWORD_DOCENTES = 'secret123';

async function runSeedHorarios(DATA, { label }) {
  console.log(`\n=== Seed de horarios: ${label} ===`);

  // ---------- 1. Espacios ----------
  const espaciosExistentes = await prisma.espacio.findMany({ select: { id_esp: true, nom_esp: true } });
  const espacioIdByNombre = new Map(espaciosExistentes.map((e) => [e.nom_esp.trim().toUpperCase(), e.id_esp]));
  let espaciosCreados = 0;
  for (const e of DATA.espacios) {
    const key = e.nom_esp.trim().toUpperCase();
    if (espacioIdByNombre.has(key)) continue;
    const creado = await prisma.espacio.create({
      data: {
        nom_esp: e.nom_esp,
        tipo: e.tipo,
        capacidad: e.capacidad,
        bloque: e.bloque,
        piso: e.piso,
        estado: e.estado,
        activo: e.activo,
      },
    });
    espacioIdByNombre.set(key, creado.id_esp);
    espaciosCreados++;
  }
  console.log(`Espacios: ${espaciosCreados} creados, ${espaciosExistentes.length} ya existían.`);

  // ---------- 2. Carreras ----------
  const carrerasExistentes = await prisma.carrera.findMany({ select: { id_car: true, nom_car: true } });
  const carreraIdByNombre = new Map(carrerasExistentes.map((c) => [c.nom_car.trim().toLowerCase(), c.id_car]));
  let carrerasCreadas = 0;
  for (const nombre of DATA.carreras) {
    const key = nombre.trim().toLowerCase();
    if (carreraIdByNombre.has(key)) continue;
    const creada = await prisma.carrera.create({ data: { nom_car: nombre } });
    carreraIdByNombre.set(key, creada.id_car);
    carrerasCreadas++;
  }
  console.log(`Carreras: ${carrerasCreadas} creadas, ${carrerasExistentes.length} ya existían.`);

  // ---------- 3. Niveles (nombre + carrera) ----------
  const nivelesExistentes = await prisma.nivel.findMany({ select: { id_niv: true, nom_niv: true, id_car: true } });
  const nivelIdByKey = new Map(
    nivelesExistentes.map((n) => [`${n.nom_niv.trim().toLowerCase()}|${n.id_car}`, n.id_niv])
  );
  let nivelesCreados = 0;
  for (const n of DATA.niveles) {
    const id_car = carreraIdByNombre.get(n.carrera.trim().toLowerCase());
    const key = `${n.nom_niv.trim().toLowerCase()}|${id_car}`;
    if (nivelIdByKey.has(key)) continue;
    const creado = await prisma.nivel.create({ data: { nom_niv: n.nom_niv, id_car } });
    nivelIdByKey.set(key, creado.id_niv);
    nivelesCreados++;
  }
  console.log(`Niveles: ${nivelesCreados} creados, ${nivelesExistentes.length} ya existían.`);

  // ---------- 4. Materias ----------
  const materiasExistentes = await prisma.materia.findMany({ select: { id_mat: true, nom_mat: true } });
  const materiaIdByNombre = new Map(materiasExistentes.map((m) => [m.nom_mat.trim().toLowerCase(), m.id_mat]));
  let materiasCreadas = 0;
  for (const nombre of DATA.materias) {
    const key = nombre.trim().toLowerCase();
    if (materiaIdByNombre.has(key)) continue;
    const creada = await prisma.materia.create({ data: { nom_mat: nombre } });
    materiaIdByNombre.set(key, creada.id_mat);
    materiasCreadas++;
  }
  console.log(`Materias: ${materiasCreadas} creadas, ${materiasExistentes.length} ya existían.`);

  // ---------- 5. Docentes (Usuario rol DOCENTE) ----------
  const docentesExistentesPorCedula = await prisma.usuario.findMany({
    where: { cedula: { in: DATA.docentes.map((d) => d.cedula) } },
    select: { id_usr: true, cedula: true, correo: true },
  });
  const docenteIdByCedula = new Map(docentesExistentesPorCedula.map((d) => [d.cedula, d.id_usr]));
  const hashedPassword = await bcrypt.hash(PASSWORD_DOCENTES, await bcrypt.genSalt(10));
  const docenteIdByNombreCompleto = new Map();
  let docentesCreados = 0;
  for (const d of DATA.docentes) {
    let id_usr = docenteIdByCedula.get(d.cedula);
    if (!id_usr) {
      const creado = await prisma.usuario.create({
        data: {
          cedula: d.cedula,
          nombres: d.nombres,
          apellidos: d.apellidos,
          correo: d.correo,
          password: hashedPassword,
          rol: 'DOCENTE',
          activo: true,
        },
      });
      id_usr = creado.id_usr;
      docentesCreados++;
    }
    docenteIdByNombreCompleto.set(d.nombreCompleto, id_usr);
  }
  console.log(`Docentes: ${docentesCreados} creados, ${docentesExistentesPorCedula.length} ya existían (por cédula).`);

  // ---------- 6. Paralelos (materia + nivel/carrera + docente + letra) ----------
  const paralelosExistentes = await prisma.paralelo.findMany({
    select: { id_par: true, nom_par: true, id_mat: true, id_niv: true, id_doc: true },
  });
  const paraleloIdByKey = new Map(
    paralelosExistentes.map((p) => [`${p.nom_par}|${p.id_mat}|${p.id_niv}|${p.id_doc}`, p.id_par])
  );
  let paralelosCreados = 0;
  let paralelosOmitidos = 0;
  for (const p of DATA.paralelos) {
    const id_mat = materiaIdByNombre.get(p.materia.trim().toLowerCase());
    const nivelKey = `${nivelFor(p.nivelNumero).trim().toLowerCase()}|${carreraIdByNombre.get(p.carrera.trim().toLowerCase())}`;
    const id_niv = nivelIdByKey.get(nivelKey);
    const id_doc = docenteIdByNombreCompleto.get(p.docente);
    if (!id_mat || !id_niv || !id_doc) { paralelosOmitidos++; continue; }
    const key = `${p.nom_par}|${id_mat}|${id_niv}|${id_doc}`;
    if (paraleloIdByKey.has(key)) continue;
    const creado = await prisma.paralelo.create({ data: { nom_par: p.nom_par, id_mat, id_niv, id_doc } });
    paraleloIdByKey.set(key, creado.id_par);
    paralelosCreados++;
  }
  console.log(`Paralelos: ${paralelosCreados} creados, ${paralelosExistentes.length} ya existían, ${paralelosOmitidos} omitidos (datos incompletos).`);

  // ---------- 7. HorarioClase ----------
  const horariosExistentes = await prisma.horarioClase.findMany({
    select: { id_hor: true, id_esp: true, nombre_curso: true, dia_semana: true, hora_ini: true, hora_fin: true, id_doc: true },
  });
  const horarioKeySet = new Set(
    horariosExistentes.map((h) => `${h.id_esp}|${h.nombre_curso}|${h.dia_semana}|${h.hora_ini}|${h.hora_fin}|${h.id_doc ?? ''}`)
  );
  let horariosCreados = 0;
  let horariosOmitidos = 0;
  const dataToInsert = [];
  for (const h of DATA.horarios) {
    const id_esp = espacioIdByNombre.get(h.espacio.trim().toUpperCase());
    const id_doc = h.docente ? docenteIdByNombreCompleto.get(h.docente) || null : null;
    if (!id_esp) { horariosOmitidos++; continue; }
    const key = `${id_esp}|${h.nombre_curso}|${h.dia_semana}|${h.hora_ini}|${h.hora_fin}|${id_doc ?? ''}`;
    if (horarioKeySet.has(key)) continue;
    horarioKeySet.add(key);
    dataToInsert.push({
      id_esp, nombre_curso: h.nombre_curso, id_doc, dia_semana: h.dia_semana,
      hora_ini: h.hora_ini, hora_fin: h.hora_fin,
    });
  }
  if (dataToInsert.length > 0) {
    const { count } = await prisma.horarioClase.createMany({ data: dataToInsert });
    horariosCreados = count;
  }
  console.log(`HorarioClase: ${horariosCreados} creados, ${horariosExistentes.length} ya existían, ${horariosOmitidos} omitidos (espacio no encontrado).`);

  // ---------- 8. Enlazar cada HorarioClase con su Paralelo (id_par) ----------
  await enlazarHorariosConParalelos(prisma);

  console.log(`=== Fin seed: ${label} ===\n`);
}

// Debe coincidir exactamente con NIVEL_NOMBRE de scripts/build (Primer..Décimo Semestre)
const NIVEL_NOMBRE = {
  1: 'Primer Semestre', 2: 'Segundo Semestre', 3: 'Tercer Semestre', 4: 'Cuarto Semestre',
  5: 'Quinto Semestre', 6: 'Sexto Semestre', 7: 'Séptimo Semestre', 8: 'Octavo Semestre',
  9: 'Noveno Semestre', 10: 'Décimo Semestre',
};
function nivelFor(numero) {
  return NIVEL_NOMBRE[numero] || `Semestre ${numero}`;
}

module.exports = { runSeedHorarios, prisma };
