const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = express.Router();
const prisma = new PrismaClient();

// ==========================================
// MATRICULAR ESTUDIANTE EN UN CURSO (SOLO ADMINISTRADORES)
// ==========================================
router.post('/', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const { id_est, id_cur } = req.body;

  if (!id_est || !id_cur) {
    return res.status(400).json({ error: 'Faltan datos (estudiante y curso).' });
  }

  try {
    const estudiante = await prisma.usuario.findUnique({ where: { id_usr: Number(id_est) } });
    if (!estudiante || estudiante.rol !== 'ESTUDIANTE') {
      return res.status(400).json({ error: 'El usuario indicado no existe o no tiene rol ESTUDIANTE.' });
    }

    const curso = await prisma.curso.findUnique({ where: { id_cur: Number(id_cur) } });
    if (!curso) {
      return res.status(404).json({ error: 'Curso no encontrado.' });
    }

    const nueva = await prisma.matricula.create({
      data: { id_est: Number(id_est), id_cur: Number(id_cur) },
      include: {
        estudiante: { select: { nombres: true, apellidos: true } },
        curso: { select: { nom_cur: true } },
      },
    });
    res.status(201).json({ mensaje: 'Estudiante matriculado exitosamente', matricula: nueva });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'El estudiante ya está matriculado en este curso.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al matricular al estudiante.' });
  }
});

// ==========================================
// LISTAR MATRÍCULAS (SOLO ADMINISTRADORES)  ?id_cur=  ?id_est=
// ==========================================
router.get('/', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const { id_cur, id_est } = req.query;

  try {
    const matriculas = await prisma.matricula.findMany({
      where: {
        ...(id_cur && { id_cur: Number(id_cur) }),
        ...(id_est && { id_est: Number(id_est) }),
      },
      include: {
        estudiante: { select: { id_usr: true, nombres: true, apellidos: true, cedula: true } },
        curso: { select: { id_cur: true, nom_cur: true } },
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
