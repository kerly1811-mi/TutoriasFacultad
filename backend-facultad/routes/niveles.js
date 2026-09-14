const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = express.Router();
const prisma = new PrismaClient();

// ==========================================
// CREAR NIVEL (SOLO ADMINISTRADORES)
// ==========================================
router.post('/', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const { nom_niv, id_car } = req.body;
  if (!nom_niv || !id_car) return res.status(400).json({ error: 'Faltan datos del nivel (nombre y carrera).' });

  try {
    const carrera = await prisma.carrera.findUnique({ where: { id_car: Number(id_car) } });
    if (!carrera) return res.status(404).json({ error: 'Carrera no encontrada.' });

    const nuevo = await prisma.nivel.create({ data: { nom_niv, id_car: Number(id_car) } });
    res.status(201).json({ mensaje: 'Nivel creado exitosamente', nivel: nuevo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear el nivel.' });
  }
});

// ==========================================
// LISTAR NIVELES (CUALQUIER USUARIO AUTENTICADO)  ?id_car=
// ==========================================
router.get('/', verificarToken, async (req, res) => {
  const { id_car } = req.query;
  try {
    const niveles = await prisma.nivel.findMany({
      where: id_car ? { id_car: Number(id_car) } : undefined,
      include: { carrera: { select: { id_car: true, nom_car: true } } },
      orderBy: { nom_niv: 'asc' },
    });
    res.json(niveles);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los niveles.' });
  }
});

// ==========================================
// ELIMINAR NIVEL (SOLO ADMINISTRADORES)
// ==========================================
router.delete('/:id', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const id_niv = Number(req.params.id);

  try {
    await prisma.nivel.delete({ where: { id_niv } });
    res.json({ mensaje: 'Nivel eliminado' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Nivel no encontrado.' });
    if (error.code === 'P2003') {
      return res.status(409).json({ error: 'No se puede eliminar: el nivel tiene paralelos asociados.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el nivel.' });
  }
});

module.exports = router;
