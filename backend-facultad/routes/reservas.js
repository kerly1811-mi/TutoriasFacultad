const express = require('express');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');
const { aMinutos, aHoraUTC, esHoraValida, seSolapan, diaSemanaDe } = require('../utils/tiempo');

const router = express.Router();
const prisma = new PrismaClient();

const incluir = {
  espacio: { select: { nom_esp: true, tipo: true } },
  solicitante: { select: { id_usr: true, nombres: true, apellidos: true } },
};

// ==========================================
// CREAR RESERVA / TUTORÍA (SOLO DOCENTES)
// Confirma al instante. "Gana el primero": si el aula ya está tomada en esa
// franja (por otra reserva o por una clase), responde 409.
// ==========================================
router.post('/', verificarToken, verificarRol(['DOCENTE']), async (req, res) => {
  const id_usr_solicitante = req.usuario.id;
  const { id_esp, fecha, hor_ini, hor_fin, motivo } = req.body;

  if (!id_esp || !fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: 'Faltan datos de la reserva (espacio y fecha).' });
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
  try {
    const reserva = await prisma.reserva.findUnique({ where: { id_rev } });
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada.' });

    const esDueno = reserva.id_usr_solicitante === req.usuario.id;
    const esAdmin = req.usuario.rol === 'ADMINISTRADOR';
    if (!esDueno && !esAdmin) {
      return res.status(403).json({ error: 'No puedes cancelar esta reserva.' });
    }

    const actualizada = await prisma.reserva.update({
      where: { id_rev },
      data: { estado: 'CANCELADA' },
      include: incluir,
    });
    res.json({ mensaje: 'Reserva cancelada', reserva: actualizada });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cancelar la reserva.' });
  }
});

module.exports = router;
