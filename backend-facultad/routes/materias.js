const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = express.Router();
const prisma = new PrismaClient();

// ==========================================
// CREAR MATERIA (SOLO ADMINISTRADORES)
// No pertenece a una carrera/nivel fijo: se asocia a uno o varios al crear paralelos.
// ==========================================
router.post('/', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const { nom_mat } = req.body;
  if (!nom_mat) return res.status(400).json({ error: 'Falta el nombre de la materia.' });

  try {
    const nueva = await prisma.materia.create({ data: { nom_mat } });
    res.status(201).json({ mensaje: 'Materia creada exitosamente', materia: nueva });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear la materia.' });
  }
});

// ==========================================
// LISTAR MATERIAS (CUALQUIER USUARIO AUTENTICADO)
// ==========================================
router.get('/', verificarToken, async (req, res) => {
  try {
    const materias = await prisma.materia.findMany({ orderBy: { nom_mat: 'asc' } });
    res.json(materias);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener las materias.' });
  }
});

// ==========================================
// EDITAR MATERIA (SOLO ADMINISTRADORES)
// ==========================================
router.put('/:id', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const id_mat = Number(req.params.id);
  const { nom_mat } = req.body;

  try {
    const actualizada = await prisma.materia.update({ where: { id_mat }, data: { nom_mat } });
    res.json({ mensaje: 'Materia actualizada', materia: actualizada });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Materia no encontrada.' });
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar la materia.' });
  }
});

// ==========================================
// ELIMINAR MATERIA (SOLO ADMINISTRADORES)
// ==========================================
router.delete('/:id', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const id_mat = Number(req.params.id);

  try {
    await prisma.materia.delete({ where: { id_mat } });
    res.json({ mensaje: 'Materia eliminada' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Materia no encontrada.' });
    if (error.code === 'P2003') {
      return res.status(409).json({ error: 'No se puede eliminar: la materia tiene paralelos asociados.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar la materia.' });
  }
});

module.exports = router;
