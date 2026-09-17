const express = require('express');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');
const { aMinutos, aHoraUTC, esHoraValida, seSolapan, diaSemanaDe } = require('../utils/tiempo');
const { crearNotificacion } = require('./notificaciones');

const router = express.Router();
const prisma = new PrismaClient();

const incluir = {
  espacio: { select: { nom_esp: true, tipo: true } },
  solicitante: { select: { id_usr: true, nombres: true, apellidos: true } },
  paralelo: {
    select: {
      id_par: true,
      nom_par: true,
      materia: { select: { nom_mat: true } },
      nivel: { select: { nom_niv: true, carrera: { select: { nom_car: true } } } },
    },
  },
};

// ==========================================
// CREAR RESERVA / TUTORÍA (DOCENTE o LABORATORISTA)
// El docente reserva ligado a un paralelo suyo (id_par obligatorio para él).
// El laboratorista reserva sin curso asociado, con un motivo obligatorio en su lugar.
// Confirma al instante. "Gana el primero": si el aula ya está tomada en esa
// franja (por otra reserva o por una clase), responde 409.
// ==========================================
router.post('/', verificarToken, verificarRol(['DOCENTE', 'LABORATORISTA']), async (req, res) => {
  const id_usr_solicitante = req.usuario.id;
  const esDocente = req.usuario.rol === 'DOCENTE';
  const { id_esp, fecha, hor_ini, hor_fin, motivo, id_par } = req.body;

  if (!id_esp || !fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: 'Faltan datos de la reserva (espacio y fecha).' });
  }
  if (esDocente && !id_par) {
    return res.status(400).json({ error: 'Falta el curso de la reserva.' });
  }
  if (!esDocente && (!motivo || !motivo.trim())) {
    return res.status(400).json({ error: 'Debes indicar un motivo para la reserva.' });
  }
  if (!esHoraValida(hor_ini) || !esHoraValida(hor_fin)) {
    return res.status(400).json({ error: 'Hora inválida (formato HH:MM).' });
  }
  const hIniTxt = hor_ini;
  const hFinTxt = hor_fin;
  const ini = aMinutos(hIniTxt);
  const fin = aMinutos(hFinTxt);
  if (fin <= ini) {
    return res.status(400).json({ error: 'La hora de fin debe ser posterior a la de inicio.' });
  }
  if (new Date(`${fecha}T00:00:00.000Z`) < new Date(new Date().toISOString().slice(0, 10))) {
    return res.status(400).json({ error: 'La fecha no puede ser anterior a hoy.' });
  }

  try {
    const espacio = await prisma.espacio.findUnique({ where: { id_esp: Number(id_esp) } });
    if (!espacio) return res.status(404).json({ error: 'El aula no existe.' });
    if (espacio.estado === 'MANTENIMIENTO') {
      return res.status(409).json({ error: 'El aula está en mantenimiento.' });
    }

    if (esDocente) {
      const paralelo = await prisma.paralelo.findUnique({ where: { id_par: Number(id_par) } });
      if (!paralelo || paralelo.id_doc !== id_usr_solicitante) {
        return res.status(400).json({ error: 'El curso indicado no existe o no te pertenece.' });
      }
    }

    // 1) ¿Choca con una clase regular de ese día?
    const clases = await prisma.horarioClase.findMany({
      where: { id_esp: Number(id_esp), dia_semana: diaSemanaDe(fecha) },
    });
    if (clases.some((c) => seSolapan(ini, fin, aMinutos(c.hora_ini), aMinutos(c.hora_fin)))) {
      return res.status(409).json({ error: 'A esa hora el aula tiene clase programada.' });
    }

    // 2) ¿Choca con otra reserva de esa fecha?
    const reservas = await prisma.reserva.findMany({
      where: { id_esp: Number(id_esp), fecha: new Date(`${fecha}T00:00:00.000Z`), estado: { not: 'CANCELADA' } },
    });
    if (reservas.some((r) => seSolapan(ini, fin, aMinutos(r.hor_ini), aMinutos(r.hor_fin)))) {
      return res.status(409).json({ error: 'El aula ya está reservada en esa franja.' });
    }

    const nuevaReserva = await prisma.reserva.create({
      data: {
        id_esp: Number(id_esp),
        id_usr_solicitante,
        fecha: new Date(`${fecha}T00:00:00.000Z`),
        hor_ini: aHoraUTC(hIniTxt),
        hor_fin: aHoraUTC(hFinTxt),
        motivo: motivo || null,
        id_par: id_par ? Number(id_par) : null,
        qr_token: crypto.randomUUID(), // lo usará la app móvil para generar el QR
        estado: 'RESERVADA',
      },
      include: incluir,
    });

    res.status(201).json({ mensaje: 'Reserva confirmada', reserva: nuevaReserva });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear la reserva.' });
  }
});

// ==========================================
// EDITAR RESERVA (solo el dueño -- docente o laboratorista que la creó)
// Mismas reglas que al crear: valida choques excluyéndose a sí misma.
// ==========================================
router.put('/:id', verificarToken, verificarRol(['DOCENTE', 'LABORATORISTA']), async (req, res) => {
  const id_rev = Number(req.params.id);
  const esDocente = req.usuario.rol === 'DOCENTE';
  const { id_esp, fecha, hor_ini, hor_fin, motivo, id_par } = req.body;

  if (!id_esp || !fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: 'Faltan datos de la reserva (espacio y fecha).' });
  }
  if (esDocente && !id_par) {
    return res.status(400).json({ error: 'Falta el curso de la reserva.' });
  }
  if (!esDocente && (!motivo || !motivo.trim())) {
    return res.status(400).json({ error: 'Debes indicar un motivo para la reserva.' });
  }
  if (!esHoraValida(hor_ini) || !esHoraValida(hor_fin)) {
    return res.status(400).json({ error: 'Hora inválida (formato HH:MM).' });
  }
  const ini = aMinutos(hor_ini);
  const fin = aMinutos(hor_fin);
  if (fin <= ini) {
    return res.status(400).json({ error: 'La hora de fin debe ser posterior a la de inicio.' });
  }
  if (new Date(`${fecha}T00:00:00.000Z`) < new Date(new Date().toISOString().slice(0, 10))) {
    return res.status(400).json({ error: 'La fecha no puede ser anterior a hoy.' });
  }

  try {
    const reserva = await prisma.reserva.findUnique({ where: { id_rev } });
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada.' });
    if (reserva.id_usr_solicitante !== req.usuario.id) {
      return res.status(403).json({ error: 'No puedes editar esta reserva.' });
    }
    if (reserva.estado === 'CANCELADA') {
      return res.status(409).json({ error: 'Esta reserva ya fue cancelada.' });
    }

    const espacio = await prisma.espacio.findUnique({ where: { id_esp: Number(id_esp) } });
    if (!espacio) return res.status(404).json({ error: 'El aula no existe.' });
    if (espacio.estado === 'MANTENIMIENTO') {
      return res.status(409).json({ error: 'El aula está en mantenimiento.' });
    }

    if (esDocente) {
      const paralelo = await prisma.paralelo.findUnique({ where: { id_par: Number(id_par) } });
      if (!paralelo || paralelo.id_doc !== req.usuario.id) {
        return res.status(400).json({ error: 'El curso indicado no existe o no te pertenece.' });
      }
    }

    const clases = await prisma.horarioClase.findMany({
      where: { id_esp: Number(id_esp), dia_semana: diaSemanaDe(fecha) },
    });
    if (clases.some((c) => seSolapan(ini, fin, aMinutos(c.hora_ini), aMinutos(c.hora_fin)))) {
      return res.status(409).json({ error: 'A esa hora el aula tiene clase programada.' });
    }

    const otrasReservas = await prisma.reserva.findMany({
      where: {
        id_esp: Number(id_esp),
        fecha: new Date(`${fecha}T00:00:00.000Z`),
        estado: { not: 'CANCELADA' },
        id_rev: { not: id_rev },
      },
    });
    if (otrasReservas.some((r) => seSolapan(ini, fin, aMinutos(r.hor_ini), aMinutos(r.hor_fin)))) {
      return res.status(409).json({ error: 'El aula ya está reservada en esa franja.' });
    }

    const actualizada = await prisma.reserva.update({
      where: { id_rev },
      data: {
        id_esp: Number(id_esp),
        fecha: new Date(`${fecha}T00:00:00.000Z`),
        hor_ini: aHoraUTC(hor_ini),
        hor_fin: aHoraUTC(hor_fin),
        motivo: motivo || null,
        id_par: id_par ? Number(id_par) : null,
      },
      include: incluir,
    });

    res.json({ mensaje: 'Reserva actualizada', reserva: actualizada });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar la reserva.' });
  }
});

// ==========================================
// LISTAR RESERVAS   ?mias=1  -> solo las del usuario del token
// ==========================================
router.get('/', verificarToken, async (req, res) => {
  const soloMias = req.query.mias === '1' || req.query.mias === 'true';
  try {
    const reservas = await prisma.reserva.findMany({
      where: soloMias ? { id_usr_solicitante: req.usuario.id } : undefined,
      include: incluir,
      orderBy: [{ fecha: 'asc' }, { hor_ini: 'asc' }],
    });
    res.json(reservas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener las reservas.' });
  }
});

// ==========================================
// CANCELAR RESERVA (el docente dueño o un administrador)
// ==========================================
router.patch('/:id/cancelar', verificarToken, async (req, res) => {
  const id_rev = Number(req.params.id);
  const { motivo } = req.body;

  if (!motivo || !motivo.trim()) {
    return res.status(400).json({ error: 'Debes indicar un motivo de cancelación.' });
  }

  try {
    const reserva = await prisma.reserva.findUnique({
      where: { id_rev },
      include: { paralelo: { select: { materia: { select: { nom_mat: true } } } }, espacio: { select: { nom_esp: true } } },
    });
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada.' });

    const esDueno = reserva.id_usr_solicitante === req.usuario.id;
    const puedeCancelarCualquiera = ['ADMINISTRADOR', 'LABORATORISTA'].includes(req.usuario.rol);
    if (!esDueno && !puedeCancelarCualquiera) {
      return res.status(403).json({ error: 'No puedes cancelar esta reserva.' });
    }

    const actualizada = await prisma.reserva.update({
      where: { id_rev },
      data: { estado: 'CANCELADA', motivo_cancelacion: motivo.trim() },
      include: incluir,
    });

    // Notifica a los estudiantes matriculados en el curso (docente o laboratorista
    // que cancela), y también al docente dueño si fue el laboratorista quien canceló.
    if (reserva.id_par) {
      const materiaTxt = reserva.paralelo?.materia?.nom_mat || 'tu curso';
      const fechaTxt = new Date(reserva.fecha).toISOString().slice(0, 10);

      const matriculas = await prisma.matricula.findMany({
        where: { id_par: reserva.id_par },
        select: { id_est: true },
      });
      await Promise.all(
        matriculas.map((m) =>
          crearNotificacion({
            id_usr: m.id_est,
            tipo: 'RESERVA_CANCELADA',
            mensaje: `Se canceló la tutoría de ${materiaTxt} del ${fechaTxt} en ${reserva.espacio?.nom_esp || 'el aula'}. Motivo: ${motivo.trim()}`,
          })
        )
      );

      if (req.usuario.rol === 'LABORATORISTA' && reserva.id_usr_solicitante !== req.usuario.id) {
        await crearNotificacion({
          id_usr: reserva.id_usr_solicitante,
          tipo: 'RESERVA_CANCELADA',
          mensaje: `El laboratorista canceló tu tutoría de ${materiaTxt} del ${fechaTxt} en ${reserva.espacio?.nom_esp || 'el aula'}. Motivo: ${motivo.trim()}`,
        });
      }
    }

    res.json({ mensaje: 'Reserva cancelada', reserva: actualizada });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cancelar la reserva.' });
  }
});

module.exports = router;
