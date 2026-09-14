const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = express.Router();
const prisma = new PrismaClient();

// ==========================================
// CREAR CARRERA (SOLO ADMINISTRADORES)
// ==========================================
router.post('/', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const { nom_car } = req.body;
  if (!nom_car) return res.status(400).json({ error: 'Falta el nombre de la carrera.' });

  try {
    const nueva = await prisma.carrera.create({ data: { nom_car } });
    res.status(201).json({ mensaje: 'Carrera creada exitosamente', carrera: nueva });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear la carrera.' });
  }
});

// ==========================================
// LISTAR CARRERAS (CUALQUIER USUARIO AUTENTICADO), con sus niveles
// ==========================================
router.get('/', verificarToken, async (req, res) => {
  try {
    const carreras = await prisma.carrera.findMany({
      include: { niveles: { orderBy: { nom_niv: 'asc' } } },
      orderBy: { nom_car: 'asc' },
    });
    res.json(carreras);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener las carreras.' });
  }
});

// ==========================================
// EDITAR CARRERA (SOLO ADMINISTRADORES)
// ==========================================
router.put('/:id', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const id_car = Number(req.params.id);
  const { nom_car } = req.body;

  try {
    const actualizada = await prisma.carrera.update({ where: { id_car }, data: { nom_car } });
    res.json({ mensaje: 'Carrera actualizada', carrera: actualizada });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Carrera no encontrada.' });
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar la carrera.' });
  }
});

// ==========================================
// ELIMINAR CARRERA (SOLO ADMINISTRADORES)
// ==========================================
router.delete('/:id', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const id_car = Number(req.params.id);

  try {
    await prisma.carrera.delete({ where: { id_car } });
    res.json({ mensaje: 'Carrera eliminada' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Carrera no encontrada.' });
    if (error.code === 'P2003') {
      return res.status(409).json({ error: 'No se puede eliminar: la carrera tiene niveles asociados.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar la carrera.' });
  }
});

module.exports = router;
