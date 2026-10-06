// Notificaciones automáticas de tutorías: inicio de la tutoría y documentos nuevos.
// Se avisa a los estudiantes matriculados en el paralelo de la reserva.
const prisma = require('../lib/prisma');
const { crearNotificacion } = require('../routes/notificaciones');
const { aMinutos, horaTxt, fechaBonita } = require('./tiempo');

const INTERVALO_MS = 60 * 1000;

const INCLUIR = {
  espacio: { select: { nom_esp: true } },
  paralelo: { select: { materia: { select: { nom_mat: true } } } },
};

function cuandoTxt(reserva) {
  return `${fechaBonita(reserva.fecha)}, ${horaTxt(reserva.hor_ini)} a ${horaTxt(reserva.hor_fin)}`;
}

// Avisa a los matriculados que no tengan ya esa misma notificación (evita repetir
// el aviso de inicio en cada ciclo o tras reiniciar el servidor).
async function avisarMatriculados(reserva, tipo, mensaje, { soloAsistentes = false } = {}) {
  if (!reserva.id_par) return;

  const destinatarios = soloAsistentes
    ? await prisma.asistencia.findMany({ where: { id_rev: reserva.id_rev }, select: { id_est: true } })
    : await prisma.matricula.findMany({ where: { id_par: reserva.id_par }, select: { id_est: true } });
  const ids = destinatarios.map((d) => d.id_est);
  if (ids.length === 0) return;

  const yaAvisados = await prisma.notificacion.findMany({
    where: { id_usr: { in: ids }, tipo, mensaje },
    select: { id_usr: true },
  });
  const avisados = new Set(yaAvisados.map((n) => n.id_usr));

  await Promise.all(
    ids.filter((id) => !avisados.has(id)).map((id_usr) => crearNotificacion({ id_usr, tipo, mensaje }))
  );
}

// Revisa las tutorías de hoy que ya comenzaron y aún no terminan.
async function avisarTutoriasEnCurso() {
  const ahora = new Date();
  const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();

  const reservas = await prisma.reserva.findMany({
    where: {
      fecha: new Date(`${hoy}T00:00:00.000Z`),
      estado: { not: 'CANCELADA' },
      id_par: { not: null },
    },
    include: INCLUIR,
  });

  for (const reserva of reservas) {
    if (minutosAhora < aMinutos(reserva.hor_ini) || minutosAhora >= aMinutos(reserva.hor_fin)) continue;
    const materia = reserva.paralelo?.materia?.nom_mat || 'tu curso';
    await avisarMatriculados(
      reserva,
      'TUTORIA_INICIO',
      `Comenzó la tutoría de ${materia} (${cuandoTxt(reserva)}) en ${reserva.espacio?.nom_esp || 'el aula'}. Escanea el QR para registrar tu asistencia.`
    );
  }
}

function iniciarAvisosDeInicio() {
  const ciclo = () => avisarTutoriasEnCurso().catch((error) => console.error('Error al avisar el inicio de tutorías:', error));
  ciclo();
  return setInterval(ciclo, INTERVALO_MS);
}

// Al compartir un documento: avisa a los estudiantes que ya registraron asistencia
// (son los únicos que pueden abrirlo).
async function notificarDocumentoNuevo(id_rev, nombreDocumento) {
  try {
    const reserva = await prisma.reserva.findUnique({ where: { id_rev }, include: INCLUIR });
    if (!reserva) return;
    const materia = reserva.paralelo?.materia?.nom_mat || 'tu tutoría';
    await avisarMatriculados(
      reserva,
      'DOCUMENTO_NUEVO',
      `Nuevo material en ${materia} (${cuandoTxt(reserva)}): ${nombreDocumento}`,
      { soloAsistentes: true }
    );
  } catch (error) {
    console.error('Error al notificar el documento nuevo:', error);
  }
}

module.exports = { iniciarAvisosDeInicio, notificarDocumentoNuevo };
