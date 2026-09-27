// ============================================================================
// ⚠️⚠️⚠️  SCRIPT DESTRUCTIVO — BORRA TODA LA BASE DE DATOS  ⚠️⚠️⚠️
// ============================================================================
// Elimina TODOS los datos de TODAS las tablas (Notificacion, Asistencia,
// Documento, Solicitud, Reserva, Matricula, HorarioClase, Paralelo, Nivel,
// Materia, Carrera, Espacio y Usuario) EXCEPTO dos usuarios que se conservan
// (o se crean si no existen):
//   cédula:  1899999999
//   correo:  kerly.test@uta.edu.ec
//   nombre:  Kerly Chicaiza
//   rol:     ADMINISTRADOR
//   clave:   secret123 (hasheada con bcryptjs, igual que el resto del proyecto)
//
//   cédula:  1800000018
//   correo:  test.laboratorista@uta.edu.ec
//   nombre:  Laboratorista Test
//   rol:     LABORATORISTA
//   clave:   secret123 (hasheada con bcryptjs, igual que el resto del proyecto)
//
//   cédula:  1800000026
//   correo:  test.docente@uta.edu.ec
//   nombre:  Docente Test
//   rol:     DOCENTE
//   clave:   secret123 (hasheada con bcryptjs, igual que el resto del proyecto)
//
//   cédula:  1800000034
//   correo:  test.estudiante@uta.edu.ec
//   nombre:  Estudiante Test
//   rol:     ESTUDIANTE
//   clave:   secret123 (hasheada con bcryptjs, igual que el resto del proyecto)
//
// El borrado respeta el orden de FKs del schema.prisma: primero las tablas
// "hoja" (sin nada que dependa de ellas) y al final Usuario.
//
// ESTE SCRIPT NO PIDE CONFIRMACIÓN INTERACTIVA (node no tiene un prompt
// bloqueante fiable multiplataforma) — la "confirmación" es este mismo bloque
// de comentarios: si lo estás corriendo, asegúrate de que es lo que quieres.
// Para evitar ejecuciones accidentales debes pasar explícitamente la bandera
// --si-estoy-seguro al invocarlo:
//
//   node prisma/reset-datos.js --si-estoy-seguro
//
// Sin esa bandera el script NO borra nada y solo imprime lo que haría.
// ============================================================================

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const ADMIN = {
  cedula: '1899999999',
  correo: 'kerly.test@uta.edu.ec',
  nombres: 'Kerly',
  apellidos: 'Chicaiza',
  rol: 'ADMINISTRADOR',
};
const ADMIN_PASSWORD = 'secret123';

const LABORATORISTA = {
  cedula: '1800000018',
  correo: 'test.laboratorista@uta.edu.ec',
  nombres: 'Laboratorista',
  apellidos: 'Test',
  rol: 'LABORATORISTA',
};
const LABORATORISTA_PASSWORD = 'secret123';

const DOCENTE = {
  cedula: '1800000026',
  correo: 'test.docente@uta.edu.ec',
  nombres: 'Docente',
  apellidos: 'Test',
  rol: 'DOCENTE',
};

const ESTUDIANTE = {
  cedula: '1800000034',
  correo: 'test.estudiante@uta.edu.ec',
  nombres: 'Estudiante',
  apellidos: 'Test',
  rol: 'ESTUDIANTE',
};

// Usuarios de prueba (además del admin y el laboratorista) que el reset conserva.
const USUARIOS_PRUEBA = [DOCENTE, ESTUDIANTE];
const USUARIOS_PRUEBA_PASSWORD = 'secret123';

async function main() {
  const confirmado = process.argv.includes('--si-estoy-seguro');

  if (!confirmado) {
    console.log('====================================================================');
    console.log('MODO SIMULACIÓN (no se borró nada).');
    console.log('Este script borra TODA la base de datos excepto el usuario admin');
    console.log(`(cédula ${ADMIN.cedula} / ${ADMIN.correo}), el usuario laboratorista`);
    console.log(`(cédula ${LABORATORISTA.cedula} / ${LABORATORISTA.correo}) y los usuarios de prueba`);
    USUARIOS_PRUEBA.forEach((u) => console.log(`  ${u.rol}: cédula ${u.cedula} / ${u.correo}`));
    console.log('Para ejecutarlo de verdad:');
    console.log('  node prisma/reset-datos.js --si-estoy-seguro');
    console.log('====================================================================');
    await prisma.$disconnect();
    return;
  }

  console.log('Borrando datos (se conserva solo el usuario administrador)...');

  // Orden de borrado: hijos primero, respetando las FKs de schema.prisma.
  const notificaciones = await prisma.notificacion.deleteMany({});
  console.log(`Notificacion: ${notificaciones.count} filas borradas.`);

  const asistencias = await prisma.asistencia.deleteMany({});
  console.log(`Asistencia: ${asistencias.count} filas borradas.`);

  const documentos = await prisma.documento.deleteMany({});
  console.log(`Documento: ${documentos.count} filas borradas.`);

  const solicitudes = await prisma.solicitud.deleteMany({});
  console.log(`Solicitud: ${solicitudes.count} filas borradas.`);

  const reservas = await prisma.reserva.deleteMany({});
  console.log(`Reserva: ${reservas.count} filas borradas.`);

  const matriculas = await prisma.matricula.deleteMany({});
  console.log(`Matricula: ${matriculas.count} filas borradas.`);

  const horarios = await prisma.horarioClase.deleteMany({});
  console.log(`HorarioClase: ${horarios.count} filas borradas.`);

  const paralelos = await prisma.paralelo.deleteMany({});
  console.log(`Paralelo: ${paralelos.count} filas borradas.`);

  const niveles = await prisma.nivel.deleteMany({});
  console.log(`Nivel: ${niveles.count} filas borradas.`);

  const materias = await prisma.materia.deleteMany({});
  console.log(`Materia: ${materias.count} filas borradas.`);

  const carreras = await prisma.carrera.deleteMany({});
  console.log(`Carrera: ${carreras.count} filas borradas.`);

  const espacios = await prisma.espacio.deleteMany({});
  console.log(`Espacio: ${espacios.count} filas borradas.`);

  // Todos los Usuario menos el admin y el laboratorista que se conservan.
  const usuariosBorrados = await prisma.usuario.deleteMany({
    where: {
      cedula: { notIn: [ADMIN.cedula, LABORATORISTA.cedula, ...USUARIOS_PRUEBA.map((u) => u.cedula)] },
      correo: { notIn: [ADMIN.correo, LABORATORISTA.correo, ...USUARIOS_PRUEBA.map((u) => u.correo)] },
    },
  });
  console.log(`Usuario: ${usuariosBorrados.count} filas borradas (se conservó/creó el admin y el laboratorista).`);

  // Crea o actualiza el usuario administrador que se conserva.
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);
  const admin = await prisma.usuario.upsert({
    where: { cedula: ADMIN.cedula },
    update: {
      nombres: ADMIN.nombres,
      apellidos: ADMIN.apellidos,
      correo: ADMIN.correo,
      rol: ADMIN.rol,
      activo: true,
    },
    create: {
      cedula: ADMIN.cedula,
      nombres: ADMIN.nombres,
      apellidos: ADMIN.apellidos,
      correo: ADMIN.correo,
      password: hashedPassword,
      rol: ADMIN.rol,
      activo: true,
    },
  });
  console.log(`Admin conservado/creado: id_usr=${admin.id_usr}, ${admin.nombres} ${admin.apellidos} (${admin.correo}).`);

  // Crea o actualiza el usuario laboratorista que se conserva.
  const laboratoristaSalt = await bcrypt.genSalt(10);
  const laboratoristaHashedPassword = await bcrypt.hash(LABORATORISTA_PASSWORD, laboratoristaSalt);
  const laboratorista = await prisma.usuario.upsert({
    where: { correo: LABORATORISTA.correo },
    update: {
      nombres: LABORATORISTA.nombres,
      apellidos: LABORATORISTA.apellidos,
      cedula: LABORATORISTA.cedula,
      rol: LABORATORISTA.rol,
      activo: true,
    },
    create: {
      cedula: LABORATORISTA.cedula,
      nombres: LABORATORISTA.nombres,
      apellidos: LABORATORISTA.apellidos,
      correo: LABORATORISTA.correo,
      password: laboratoristaHashedPassword,
      rol: LABORATORISTA.rol,
      activo: true,
    },
  });
  console.log(`Laboratorista conservado/creado: id_usr=${laboratorista.id_usr}, ${laboratorista.nombres} ${laboratorista.apellidos} (${laboratorista.correo}).`);

  // Crea o actualiza los usuarios de prueba (docente y estudiante) que se conservan.
  await crearUsuariosPrueba();
  console.log('Listo.');
}

async function crearUsuariosPrueba() {
  const hashedPassword = await bcrypt.hash(USUARIOS_PRUEBA_PASSWORD, await bcrypt.genSalt(10));
  for (const u of USUARIOS_PRUEBA) {
    const usuario = await prisma.usuario.upsert({
      where: { correo: u.correo },
      update: { nombres: u.nombres, apellidos: u.apellidos, cedula: u.cedula, rol: u.rol, activo: true },
      create: { ...u, password: hashedPassword, activo: true },
    });
    console.log(`${u.rol} de prueba conservado/creado: id_usr=${usuario.id_usr}, ${usuario.correo}.`);
  }
}

// `node prisma/reset-datos.js --solo-usuarios-prueba` crea/actualiza solo el docente y el
// estudiante de prueba, sin borrar nada (útil si la base ya tiene datos cargados).
if (process.argv.includes('--solo-usuarios-prueba')) {
  crearUsuariosPrueba()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
} else main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
