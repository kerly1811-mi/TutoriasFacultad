const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = express.Router();
const prisma = new PrismaClient();

const incluir = {
  materia: { select: { id_mat: true, nom_mat: true } },
  nivel: {
    select: {
      id_niv: true,
      nom_niv: true,
      carrera: { select: { id_car: true, nom_car: true } },
    },
  },
  docente: { select: { id_usr: true, nombres: true, apellidos: true } },
};

// ==========================================
// CREAR PARALELO (SOLO ADMINISTRADORES)
// Materia dictada en un nivel concreto por un docente concreto.
// ==========================================
router.post('/', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const { nom_par, id_mat, id_niv, id_doc } = req.body;

  if (!nom_par || !id_mat || !id_niv || !id_doc) {
    return res.status(400).json({ error: 'Faltan datos del paralelo (nombre, materia, nivel y docente).' });
  }

  try {
    const [materia, nivel, docente] = await Promise.all([
      prisma.materia.findUnique({ where: { id_mat: Number(id_mat) } }),
      prisma.nivel.findUnique({ where: { id_niv: Number(id_niv) } }),
      prisma.usuario.findUnique({ where: { id_usr: Number(id_doc) } }),
    ]);
    if (!materia) return res.status(404).json({ error: 'Materia no encontrada.' });
    if (!nivel) return res.status(404).json({ error: 'Nivel no encontrado.' });
    if (!docente || docente.rol !== 'DOCENTE') {
      return res.status(400).json({ error: 'El docente indicado no existe o no tiene rol DOCENTE.' });
    }

    const nuevo = await prisma.paralelo.create({
      data: { nom_par, id_mat: Number(id_mat), id_niv: Number(id_niv), id_doc: Number(id_doc) },
      include: incluir,
    });
    res.status(201).json({ mensaje: 'Paralelo creado exitosamente', paralelo: nuevo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear el paralelo.' });
  }
});

// ==========================================
// LISTAR PARALELOS (CUALQUIER USUARIO AUTENTICADO)  ?id_niv=  ?id_doc=
// ==========================================
router.get('/', verificarToken, async (req, res) => {
  const { id_niv, id_doc } = req.query;

  try {
    const paralelos = await prisma.paralelo.findMany({
      where: {
        ...(id_niv && { id_niv: Number(id_niv) }),
        ...(id_doc && { id_doc: Number(id_doc) }),
      },
      include: incluir,
      orderBy: { nom_par: 'asc' },
    });
    res.json(paralelos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los paralelos.' });
  }
});

// ==========================================
// EDITAR PARALELO (SOLO ADMINISTRADORES)
// ==========================================
router.put('/:id', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const id_par = Number(req.params.id);
  const { nom_par, id_mat, id_niv, id_doc } = req.body;

  try {
    if (id_doc !== undefined) {
      const docente = await prisma.usuario.findUnique({ where: { id_usr: Number(id_doc) } });
      if (!docente || docente.rol !== 'DOCENTE') {
        return res.status(400).json({ error: 'El docente indicado no existe o no tiene rol DOCENTE.' });
      }
    }

    const actualizado = await prisma.paralelo.update({
      where: { id_par },
      data: {
        ...(nom_par !== undefined && { nom_par }),
        ...(id_mat !== undefined && { id_mat: Number(id_mat) }),
        ...(id_niv !== undefined && { id_niv: Number(id_niv) }),
        ...(id_doc !== undefined && { id_doc: Number(id_doc) }),
      },
      include: incluir,
    });
    res.json({ mensaje: 'Paralelo actualizado', paralelo: actualizado });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Paralelo no encontrado.' });
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el paralelo.' });
  }
});

// ==========================================
// ELIMINAR PARALELO (SOLO ADMINISTRADORES)
// ==========================================
router.delete('/:id', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const id_par = Number(req.params.id);

  try {
    await prisma.paralelo.delete({ where: { id_par } });
    res.json({ mensaje: 'Paralelo eliminado' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Paralelo no encontrado.' });
    if (error.code === 'P2003') {
      return res
        .status(409)
        .json({ error: 'No se puede eliminar: el paralelo tiene matrículas o tutorías asociadas.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el paralelo.' });
  }
});

module.exports = router;
