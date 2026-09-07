const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verificarToken } = require('../middlewares/authMiddleware');

const router = express.Router();
const prisma = new PrismaClient();

// ==========================================
// TUTORÍAS HABILITADAS (para estudiantes)
// Reservas confirmadas de hoy en adelante: qué, dónde, cuándo y con quién.
// ==========================================
router.get('/', verificarToken, async (req, res) => {
  const hoy = new Date(new Date().toISOString().slice(0, 10));

  try {
    let idsCursos = null; // null = sin restricción (cualquier rol distinto de ESTUDIANTE)
    if (req.usuario.rol === 'ESTUDIANTE') {
      const matriculas = await prisma.matricula.findMany({
        where: { id_est: req.usuario.id },
        select: { id_cur: true },
      });
      idsCursos = matriculas.map((m) => m.id_cur);
      // Un estudiante sin cursos no debe ver ninguna tutoría (ni las que no tienen curso asignado).
      if (idsCursos.length === 0) return res.json([]);
    }

    const reservas = await prisma.reserva.findMany({
      where: {
        estado: 'RESERVADA',
        fecha: { gte: hoy },
        ...(idsCursos && { id_cur: { in: idsCursos } }),
      },
      include: {
        espacio: { select: { nom_esp: true, tipo: true, bloque: true, piso: true } },
        solicitante: { select: { nombres: true, apellidos: true } },
        curso: { select: { nom_cur: true } },
      },
      orderBy: [{ fecha: 'asc' }, { hor_ini: 'asc' }],
    });

    const tutorias = reservas.map((r) => ({
      id_rev: r.id_rev,
      aula: r.espacio?.nom_esp || '—',
      tipo: r.espacio?.tipo || null,
      bloque: r.espacio?.bloque || null,
      piso: r.espacio?.piso || null,
      fecha: r.fecha,
      hora_ini: fmt(r.hor_ini),
      hora_fin: fmt(r.hor_fin),
      docente: r.solicitante ? `${r.solicitante.nombres} ${r.solicitante.apellidos}` : 'Docente',
      curso: r.curso?.nom_cur || null,
      tema: r.motivo || 'Tutoría',
    }));

    res.json(tutorias);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener las tutorías.' });
  }
});

function fmt(dateTime) {
  const d = new Date(dateTime);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

module.exports = router;
