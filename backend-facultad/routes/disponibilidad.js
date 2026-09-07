const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verificarToken } = require('../middlewares/authMiddleware');
const { aMinutos, esHoraValida, seSolapan, diaSemanaDe } = require('../utils/tiempo');

const router = express.Router();
const prisma = new PrismaClient();

// ==========================================
// DISPONIBILIDAD DE AULAS
// GET /api/disponibilidad?fecha=YYYY-MM-DD&hora_ini=HH:MM&hora_fin=HH:MM
// (hora_ini / hora_fin son opcionales: sin ellas devuelve la agenda del día)
// ==========================================
router.get('/', verificarToken, async (req, res) => {
  const { fecha, hora_ini, hora_fin } = req.query;

  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: 'Falta la fecha (YYYY-MM-DD).' });
  }
  const conFranja = Boolean(hora_ini && hora_fin);
  if (conFranja && (!esHoraValida(hora_ini) || !esHoraValida(hora_fin))) {
    return res.status(400).json({ error: 'Hora inválida (formato HH:MM).' });
  }
  if (conFranja && aMinutos(hora_fin) <= aMinutos(hora_ini)) {
    return res.status(400).json({ error: 'La hora de fin debe ser posterior a la de inicio.' });
  }

  const dia = diaSemanaDe(fecha);

  try {
    const [espacios, horarios, reservas] = await Promise.all([
      prisma.espacio.findMany({ where: { estado: 'DISPONIBLE' }, orderBy: { nom_esp: 'asc' } }),
      prisma.horarioClase.findMany({ where: { dia_semana: dia } }),
      prisma.reserva.findMany({
        where: { fecha: new Date(`${fecha}T00:00:00.000Z`), estado: { not: 'CANCELADA' } },
        include: { solicitante: { select: { nombres: true, apellidos: true } } },
      }),
    ]);

    const resultado = espacios.map((esp) => {
      const ocupaciones = [
        ...horarios
          .filter((h) => h.id_esp === esp.id_esp)
          .map((h) => ({
            tipo: 'CLASE',
            etiqueta: h.nombre_curso,
            hora_ini: h.hora_ini,
            hora_fin: h.hora_fin,
            ini: aMinutos(h.hora_ini),
            fin: aMinutos(h.hora_fin),
          })),
        ...reservas
          .filter((r) => r.id_esp === esp.id_esp)
          .map((r) => ({
            tipo: 'RESERVA',
            etiqueta: r.solicitante
              ? `${r.solicitante.nombres} ${r.solicitante.apellidos}`
              : r.motivo || 'Reserva',
            hora_ini: fmt(r.hor_ini),
            hora_fin: fmt(r.hor_fin),
            ini: aMinutos(r.hor_ini),
            fin: aMinutos(r.hor_fin),
          })),
      ].sort((a, b) => a.ini - b.ini);

      const libre = conFranja
        ? !ocupaciones.some((o) => seSolapan(o.ini, o.fin, aMinutos(hora_ini), aMinutos(hora_fin)))
        : ocupaciones.length === 0;

      return {
        id_esp: esp.id_esp,
        nom_esp: esp.nom_esp,
        tipo: esp.tipo,
        capacidad: esp.capacidad,
        bloque: esp.bloque,
        piso: esp.piso,
        libre,
        ocupaciones: ocupaciones.map(({ ini, fin, ...resto }) => resto),
      };
    });

    res.json({ fecha, dia_semana: dia, con_franja: conFranja, espacios: resultado });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al calcular la disponibilidad.' });
  }
});

function fmt(dateTime) {
  const d = new Date(dateTime);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

module.exports = router;
