const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = express.Router();
const prisma = new PrismaClient();

// ==========================================
// CREAR CURSO (SOLO ADMINISTRADORES)
// ==========================================
router.post('/', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const { nom_cur, id_doc } = req.body;

  if (!nom_cur || !id_doc) {
    return res.status(400).json({ error: 'Faltan datos del curso (nombre y docente).' });
  }

  try {
    const docente = await prisma.usuario.findUnique({ where: { id_usr: Number(id_doc) } });
    if (!docente || docente.rol !== 'DOCENTE') {
      return res.status(400).json({ error: 'El docente indicado no existe o no tiene rol DOCENTE.' });
    }

    const nuevo = await prisma.curso.create({
      data: { nom_cur, id_doc: Number(id_doc) },
      include: { docente: { select: { nombres: true, apellidos: true } } },
    });
    res.status(201).json({ mensaje: 'Curso creado exitosamente', curso: nuevo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear el curso.' });
  }
});

// ==========================================
// LISTAR CURSOS (CUALQUIER USUARIO AUTENTICADO)
// ==========================================
router.get('/', verificarToken, async (req, res) => {
  try {
    const cursos = await prisma.curso.findMany({
      include: { docente: { select: { id_usr: true, nombres: true, apellidos: true } } },
      orderBy: { nom_cur: 'asc' },
    });
    res.json(cursos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los cursos.' });
  }
});

// ==========================================
// EDITAR CURSO (SOLO ADMINISTRADORES)
// ==========================================
router.put('/:id', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const id_cur = Number(req.params.id);
  const { nom_cur, id_doc } = req.body;

  try {
    if (id_doc !== undefined) {
      const docente = await prisma.usuario.findUnique({ where: { id_usr: Number(id_doc) } });
      if (!docente || docente.rol !== 'DOCENTE') {
        return res.status(400).json({ error: 'El docente indicado no existe o no tiene rol DOCENTE.' });
      }
    }

    const actualizado = await prisma.curso.update({
      where: { id_cur },
      data: {
        ...(nom_cur !== undefined && { nom_cur }),
        ...(id_doc !== undefined && { id_doc: Number(id_doc) }),
      },
    });
    res.json({ mensaje: 'Curso actualizado', curso: actualizado });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Curso no encontrado.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el curso.' });
  }
});

// ==========================================
// ELIMINAR CURSO (SOLO ADMINISTRADORES)
// ==========================================
router.delete('/:id', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const id_cur = Number(req.params.id);

  try {
    await prisma.curso.delete({ where: { id_cur } });
    res.json({ mensaje: 'Curso eliminado' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Curso no encontrado.' });
    }
    if (error.code === 'P2003') {
      return res
        .status(409)
        .json({ error: 'No se puede eliminar: el curso tiene matrículas o tutorías asociadas.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el curso.' });
  }
});

module.exports = router;
