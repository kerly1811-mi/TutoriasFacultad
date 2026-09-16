const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = express.Router();
const prisma = new PrismaClient();

const incluirParalelo = {
  materia: { select: { nom_mat: true } },
  nivel: { select: { nom_niv: true, carrera: { select: { nom_car: true } } } },
  docente: { select: { id_usr: true, nombres: true, apellidos: true } },
};

// ==========================================
// MATRICULAR ESTUDIANTE EN UN PARALELO (SOLO ADMINISTRADORES)
// ==========================================
router.post('/', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const { id_est, id_par } = req.body;

  if (!id_est || !id_par) {
    return res.status(400).json({ error: 'Faltan datos (estudiante y paralelo).' });
  }

  try {
    const estudiante = await prisma.usuario.findUnique({ where: { id_usr: Number(id_est) } });
    if (!estudiante || estudiante.rol !== 'ESTUDIANTE') {
      return res.status(400).json({ error: 'El usuario indicado no existe o no tiene rol ESTUDIANTE.' });
    }

    const paralelo = await prisma.paralelo.findUnique({ where: { id_par: Number(id_par) } });
    if (!paralelo) {
      return res.status(404).json({ error: 'Paralelo no encontrado.' });
    }

    const nueva = await prisma.matricula.create({
      data: { id_est: Number(id_est), id_par: Number(id_par) },
      include: {
        estudiante: { select: { nombres: true, apellidos: true } },
        paralelo: { include: incluirParalelo },
      },
    });
    res.status(201).json({ mensaje: 'Estudiante matriculado exitosamente', matricula: nueva });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'El estudiante ya está matriculado en este paralelo.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al matricular al estudiante.' });
  }
});

// ==========================================
// LISTAR MATRÍCULAS   ?id_par=  ?id_est=
// ADMINISTRADOR ve cualquier combinación. ESTUDIANTE solo puede ver las suyas
// (se ignora cualquier `id_est` que mande; siempre se fuerza al suyo propio).
// ==========================================
router.get('/', verificarToken, async (req, res) => {
  const esAdmin = req.usuario.rol === 'ADMINISTRADOR';
  if (!esAdmin && req.usuario.rol !== 'ESTUDIANTE') {
    return res.status(403).json({ error: 'No tienes permiso para ver las matrículas.' });
  }

  const { id_par } = req.query;
  const id_est = esAdmin ? req.query.id_est : req.usuario.id;

  try {
    const matriculas = await prisma.matricula.findMany({
      where: {
        ...(id_par && { id_par: Number(id_par) }),
        ...(id_est && { id_est: Number(id_est) }),
      },
      include: {
        estudiante: { select: { id_usr: true, nombres: true, apellidos: true, cedula: true } },
        paralelo: { include: incluirParalelo },
      },
      orderBy: { id_matricula: 'desc' },
    });
    res.json(matriculas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener las matrículas.' });
  }
});

// ==========================================
// ELIMINAR MATRÍCULA (SOLO ADMINISTRADORES)
// ==========================================
router.delete('/:id', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const id_matricula = Number(req.params.id);

  try {
    await prisma.matricula.delete({ where: { id_matricula } });
    res.json({ mensaje: 'Matrícula eliminada' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Matrícula no encontrada.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar la matrícula.' });
  }
});

module.exports = router;
