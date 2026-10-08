const express = require('express');
const crypto = require('crypto');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');
const {
  aMinutos,
  aHoraUTC,
  esHoraValida,
  seSolapan,
  diaSemanaDe,
  fechaBonita,
  horaTxt,
  errorDeJornada,
  ahoraLocal,
} = require('../utils/tiempo');
const { crearNotificacion } = require('./notificaciones');

const router = express.Router();
const prisma = require('../lib/prisma');

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
  _count: { select: { asistencias: true, documentos: true } },
};

// ==========================================
// CREAR RESERVA / TUTORÍA (LABORATORISTA o DOCENTE)
// El docente reserva ligado a un paralelo suyo (id_par obligatorio para él).
// El administrador puede reservar con motivo o asociando un paralelo.
// Confirma al instante. Si el aula está ocupada, responde 409.
// ==========================================
router.post('/', verificarToken, verificarRol(['LABORATORISTA', 'DOCENTE']), async (req, res) => {
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
  if (fecha < ahoraLocal().fecha) {
    return res.status(400).json({ error: 'La fecha no puede ser anterior a hoy.' });
  }
  const errorJornada = errorDeJornada({ fecha, hora_ini: hor_ini, hora_fin: hor_fin });
  if (errorJornada) return res.status(400).json({ error: errorJornada });

  try {
    const espacio = await prisma.espacio.findUnique({ where: { id_esp: Number(id_esp) } });
    if (!espacio) return res.status(404).json({ error: 'El aula no existe.' });
    if (espacio.estado === 'MANTENIMIENTO' || !espacio.activo) {
      return res.status(409).json({ error: 'El aula no está disponible.' });
    }

    if (esDocente && id_par) {
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

    // 2) ¿Choca con otra reserva de esa fecha, en la misma aula?
    const reservas = await prisma.reserva.findMany({
      where: { id_esp: Number(id_esp), fecha: new Date(`${fecha}T00:00:00.000Z`), estado: { not: 'CANCELADA' } },
    });
    if (reservas.some((r) => seSolapan(ini, fin, aMinutos(r.hor_ini), aMinutos(r.hor_fin)))) {
      return res.status(409).json({ error: 'El aula ya está reservada en esa franja.' });
    }

    // 3) ¿El solicitante ya tiene otra reserva a esa hora, en cualquier otra aula?
    const reservasSolicitante = await prisma.reserva.findMany({
      where: {
        id_usr_solicitante,
        fecha: new Date(`${fecha}T00:00:00.000Z`),
        estado: { not: 'CANCELADA' },
      },
    });
    if (reservasSolicitante.some((r) => seSolapan(ini, fin, aMinutos(r.hor_ini), aMinutos(r.hor_fin)))) {
      return res.status(409).json({ error: 'Ya tienes otra reserva en ese horario, en otra aula.' });
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
        qr_token: crypto.randomUUID(),
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
// EDITAR RESERVA (el docente dueño o administrador)
// ==========================================
router.put('/:id', verificarToken, verificarRol(['LABORATORISTA', 'DOCENTE']), async (req, res) => {
  const id_rev = Number(req.params.id);
  const esDocente = req.usuario.rol === 'DOCENTE';
  const esLaboratorista = req.usuario.rol === 'LABORATORISTA';
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
  if (fecha < ahoraLocal().fecha) {
    return res.status(400).json({ error: 'La fecha no puede ser anterior a hoy.' });
  }
  const errorJornada = errorDeJornada({ fecha, hora_ini: hor_ini, hora_fin: hor_fin });
  if (errorJornada) return res.status(400).json({ error: errorJornada });

  try {
    const reserva = await prisma.reserva.findUnique({ where: { id_rev } });
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada.' });
    if (reserva.id_usr_solicitante !== req.usuario.id && !esLaboratorista) {
      return res.status(403).json({ error: 'No tienes permisos para editar esta reserva.' });
    }
    if (reserva.estado === 'CANCELADA') {
      return res.status(409).json({ error: 'Esta reserva ya fue cancelada.' });
    }

    const espacio = await prisma.espacio.findUnique({ where: { id_esp: Number(id_esp) } });
    if (!espacio) return res.status(404).json({ error: 'El aula no existe.' });
    if (espacio.estado === 'MANTENIMIENTO' || !espacio.activo) {
      return res.status(409).json({ error: 'El aula no está disponible.' });
    }

    if (esDocente && id_par) {
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

    const reservasSolicitante = await prisma.reserva.findMany({
      where: {
        id_usr_solicitante: reserva.id_usr_solicitante,
        fecha: new Date(`${fecha}T00:00:00.000Z`),
        estado: { not: 'CANCELADA' },
        id_rev: { not: id_rev },
      },
    });
    if (reservasSolicitante.some((r) => seSolapan(ini, fin, aMinutos(r.hor_ini), aMinutos(r.hor_fin)))) {
      return res.status(409).json({ error: 'Ya tienes otra reserva en ese horario, en otra aula.' });
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
// CANCELAR RESERVA (el docente dueño o un laboratorista)
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
    const puedeCancelarCualquiera = ['LABORATORISTA'].includes(req.usuario.rol);
    if (!esDueno && !puedeCancelarCualquiera) {
      return res.status(403).json({ error: 'No puedes cancelar esta reserva.' });
    }

    const actualizada = await prisma.reserva.update({
      where: { id_rev },
      data: { estado: 'CANCELADA', motivo_cancelacion: motivo.trim() },
      include: incluir,
    });

    if (reserva.id_par) {
      const materiaTxt = reserva.paralelo?.materia?.nom_mat || 'tu curso';
      const cuandoTxt = `${fechaBonita(reserva.fecha)}, ${horaTxt(reserva.hor_ini)} a ${horaTxt(reserva.hor_fin)}`;

      const matriculas = await prisma.matricula.findMany({
        where: { id_par: reserva.id_par },
        select: { id_est: true },
      });
      await Promise.all(
        matriculas.map((m) =>
          crearNotificacion({
            id_usr: m.id_est,
            tipo: 'RESERVA_CANCELADA',
            mensaje: `Se canceló la tutoría de ${materiaTxt} del ${cuandoTxt} en ${reserva.espacio?.nom_esp || 'el aula'}. Motivo: ${motivo.trim()}`,
          })
        )
      );

      if (req.usuario.rol === 'LABORATORISTA' && reserva.id_usr_solicitante !== req.usuario.id) {
        await crearNotificacion({
          id_usr: reserva.id_usr_solicitante,
          tipo: 'RESERVA_CANCELADA',
          mensaje: `El laboratorista canceló tu tutoría de ${materiaTxt} del ${cuandoTxt} en ${reserva.espacio?.nom_esp || 'el aula'}. Motivo: ${motivo.trim()}`,
        });
      }
    }

    res.json({ mensaje: 'Reserva cancelada', reserva: actualizada });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cancelar la reserva.' });
  }
});

// ==========================================
// FINALIZAR TUTORÍA ANTES DE TIEMPO (docente dueño o laboratorista)
// ==========================================
router.patch('/:id/finalizar', verificarToken, verificarRol(['DOCENTE', 'LABORATORISTA']), async (req, res) => {
  const id_rev = Number(req.params.id);
  const { hora_fin } = req.body;

  if (!esHoraValida(hora_fin)) {
    return res.status(400).json({ error: 'Hora inválida (formato HH:MM).' });
  }

  try {
    const reserva = await prisma.reserva.findUnique({ where: { id_rev } });
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada.' });
    if (reserva.id_usr_solicitante !== req.usuario.id && req.usuario.rol !== 'LABORATORISTA') {
      return res.status(403).json({ error: 'No puedes finalizar esta reserva.' });
    }
    if (reserva.estado === 'CANCELADA') {
      return res.status(409).json({ error: 'Esta reserva ya fue cancelada.' });
    }
    if (aMinutos(hora_fin) <= aMinutos(reserva.hor_ini)) {
      return res.status(400).json({ error: 'La hora de fin debe ser posterior a la de inicio.' });
    }

    const actualizada = await prisma.reserva.update({
      where: { id_rev },
      data: { hor_fin: aHoraUTC(hora_fin) },
      include: incluir,
    });

    res.json({ mensaje: 'Tutoría finalizada', reserva: actualizada });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al finalizar la tutoría.' });
  }
});

module.exports = router;
