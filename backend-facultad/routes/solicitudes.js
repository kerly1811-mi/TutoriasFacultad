const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');
const { aMinutos, aHoraUTC, esHoraValida, seSolapan, diaSemanaDe, fechaBonita } = require('../utils/tiempo');
const { crearNotificacion } = require('./notificaciones');

const router = express.Router();
const prisma = new PrismaClient();

const incluir = {
  estudiante: { select: { id_usr: true, nombres: true, apellidos: true } },
  espacio: { select: { id_esp: true, nom_esp: true, tipo: true } },
  paralelo: {
    select: {
      id_par: true,
      nom_par: true,
      materia: { select: { nom_mat: true } },
      nivel: { select: { nom_niv: true, carrera: { select: { nom_car: true } } } },
      docente: { select: { id_usr: true, nombres: true, apellidos: true } },
    },
  },
};

function fmt(dateTime) {
  const d = new Date(dateTime);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

// ==========================================
// CREAR SOLICITUD (ESTUDIANTE, solo para un paralelo en el que está matriculado)
// ==========================================
router.post('/', verificarToken, verificarRol(['ESTUDIANTE']), async (req, res) => {
  const id_est = req.usuario.id;
  const { id_par, id_esp, fecha, hor_ini, hor_fin, tema } = req.body;

  if (!id_par || !id_esp || !fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: 'Faltan datos de la solicitud (curso, espacio y fecha).' });
  }
  if (!esHoraValida(hor_ini) || !esHoraValida(hor_fin)) {
    return res.status(400).json({ error: 'Hora inválida (formato HH:MM).' });
  }
  if (aMinutos(hor_fin) <= aMinutos(hor_ini)) {
    return res.status(400).json({ error: 'La hora de fin debe ser posterior a la de inicio.' });
  }
  if (new Date(`${fecha}T00:00:00.000Z`) < new Date(new Date().toISOString().slice(0, 10))) {
    return res.status(400).json({ error: 'La fecha no puede ser anterior a hoy.' });
  }

  try {
    const matricula = await prisma.matricula.findFirst({ where: { id_est, id_par: Number(id_par) } });
    if (!matricula) {
      return res.status(400).json({ error: 'No estás matriculado en ese curso.' });
    }

    const espacio = await prisma.espacio.findUnique({ where: { id_esp: Number(id_esp) } });
    if (!espacio) return res.status(404).json({ error: 'El aula no existe.' });
    if (espacio.estado === 'MANTENIMIENTO') {
      return res.status(409).json({ error: 'El aula está en mantenimiento.' });
    }

    const ini = aMinutos(hor_ini);
    const fin = aMinutos(hor_fin);
    const [clases, reservas] = await Promise.all([
      prisma.horarioClase.findMany({ where: { id_esp: Number(id_esp), dia_semana: diaSemanaDe(fecha) } }),
      prisma.reserva.findMany({
        where: { id_esp: Number(id_esp), fecha: new Date(`${fecha}T00:00:00.000Z`), estado: { not: 'CANCELADA' } },
      }),
    ]);
    if (clases.some((c) => seSolapan(ini, fin, aMinutos(c.hora_ini), aMinutos(c.hora_fin)))) {
      return res.status(409).json({ error: 'A esa hora el aula tiene clase programada.' });
    }
    if (reservas.some((r) => seSolapan(ini, fin, aMinutos(r.hor_ini), aMinutos(r.hor_fin)))) {
      return res.status(409).json({ error: 'El aula ya está reservada en esa franja.' });
    }

    const paralelo = await prisma.paralelo.findUnique({
      where: { id_par: Number(id_par) },
      include: { materia: true, docente: true },
    });

    const solicitud = await prisma.solicitud.create({
      data: {
        id_est,
        id_par: Number(id_par),
        id_esp: Number(id_esp),
        fecha: new Date(`${fecha}T00:00:00.000Z`),
        hor_ini: aHoraUTC(hor_ini),
        hor_fin: aHoraUTC(hor_fin),
        tema: tema || null,
      },
      include: incluir,
    });

    const estudiante = await prisma.usuario.findUnique({ where: { id_usr: id_est } });
    await crearNotificacion({
      id_usr: paralelo.id_doc,
      tipo: 'SOLICITUD_NUEVA',
      id_sol: solicitud.id_sol,
      mensaje: `${estudiante.nombres} ${estudiante.apellidos} solicitó una tutoría de ${paralelo.materia.nom_mat} en ${espacio.nom_esp} para el ${fechaBonita(fecha)} de ${hor_ini} a ${hor_fin}.`,
    });

    res.status(201).json({ mensaje: 'Solicitud enviada', solicitud });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear la solicitud.' });
  }
});

// ==========================================
// LISTAR SOLICITUDES
// DOCENTE: las de sus paralelos. ESTUDIANTE: las suyas.
// ==========================================
router.get('/', verificarToken, verificarRol(['DOCENTE', 'ESTUDIANTE']), async (req, res) => {
  try {
    const where =
      req.usuario.rol === 'DOCENTE' ? { paralelo: { id_doc: req.usuario.id } } : { id_est: req.usuario.id };

    const solicitudes = await prisma.solicitud.findMany({
      where,
      include: incluir,
      orderBy: [{ creado_en: 'desc' }],
    });

    const resultado = solicitudes.map((s) => ({
      ...s,
      hor_ini: fmt(s.hor_ini),
      hor_fin: fmt(s.hor_fin),
    }));

    res.json(resultado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener las solicitudes.' });
  }
});

// ==========================================
// ACEPTAR (DOCENTE dueño del paralelo)
// ==========================================
router.patch('/:id/aceptar', verificarToken, verificarRol(['DOCENTE']), async (req, res) => {
  const id_sol = Number(req.params.id);
  try {
    const solicitud = await prisma.solicitud.findUnique({ where: { id_sol }, include: incluir });
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada.' });
    if (solicitud.paralelo.docente.id_usr !== req.usuario.id) {
      return res.status(403).json({ error: 'No puedes gestionar esta solicitud.' });
    }
    if (solicitud.estado !== 'PENDIENTE') {
      return res.status(409).json({ error: 'Esta solicitud ya fue resuelta.' });
    }

    const actualizada = await prisma.solicitud.update({
      where: { id_sol },
      data: { estado: 'ACEPTADA', resuelto_en: new Date() },
      include: incluir,
    });

    await crearNotificacion({
      id_usr: solicitud.id_est,
      tipo: 'SOLICITUD_ACEPTADA',
      id_sol,
      mensaje: `Tu solicitud de tutoría de ${solicitud.paralelo.materia.nom_mat} fue aceptada. Se reservará ${solicitud.espacio.nom_esp} para esa fecha y hora.`,
    });

    res.json({ mensaje: 'Solicitud aceptada', solicitud: actualizada });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al aceptar la solicitud.' });
  }
});

// ==========================================
// RECHAZAR (DOCENTE dueño del paralelo) -- requiere razón
// ==========================================
router.patch('/:id/rechazar', verificarToken, verificarRol(['DOCENTE']), async (req, res) => {
  const id_sol = Number(req.params.id);
  const { razon } = req.body;

  if (!razon || !razon.trim()) {
    return res.status(400).json({ error: 'Debes indicar una razón de rechazo.' });
  }

  try {
    const solicitud = await prisma.solicitud.findUnique({ where: { id_sol }, include: incluir });
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada.' });
    if (solicitud.paralelo.docente.id_usr !== req.usuario.id) {
      return res.status(403).json({ error: 'No puedes gestionar esta solicitud.' });
    }
    if (solicitud.estado !== 'PENDIENTE') {
      return res.status(409).json({ error: 'Esta solicitud ya fue resuelta.' });
    }

    const actualizada = await prisma.solicitud.update({
      where: { id_sol },
      data: { estado: 'RECHAZADA', razon_rechazo: razon.trim(), resuelto_en: new Date() },
      include: incluir,
    });

    await crearNotificacion({
      id_usr: solicitud.id_est,
      tipo: 'SOLICITUD_RECHAZADA',
      id_sol,
      mensaje: `Tu solicitud de tutoría de ${solicitud.paralelo.materia.nom_mat} fue rechazada.`,
    });

    res.json({ mensaje: 'Solicitud rechazada', solicitud: actualizada });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al rechazar la solicitud.' });
  }
});

module.exports = router;
