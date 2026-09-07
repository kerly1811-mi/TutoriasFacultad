const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = express.Router();
const prisma = new PrismaClient();

const TIPOS = ['AULA', 'LABORATORIO'];
const ESTADOS = ['DISPONIBLE', 'MANTENIMIENTO'];
const PISOS_POR_BLOQUE = {
  BLOQUE_1: ['1', '2', '3'],
  BLOQUE_2: ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
};
const BLOQUES = Object.keys(PISOS_POR_BLOQUE);

function bloqueYPisoValidos(bloque, piso) {
  return BLOQUES.includes(bloque) && PISOS_POR_BLOQUE[bloque].includes(piso);
}

// ==========================================
// CREAR ESPACIO (SOLO ADMINISTRADORES)
// ==========================================
router.post('/', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const { nom_esp, tipo, capacidad, bloque, piso, estado } = req.body;

  if (!nom_esp || !TIPOS.includes(tipo) || !capacidad) {
    return res.status(400).json({ error: 'Datos del espacio incompletos o inválidos.' });
  }
  if (!bloqueYPisoValidos(bloque, piso)) {
    return res.status(400).json({ error: 'Bloque o piso inválido para el espacio.' });
  }

  try {
    const nuevoEspacio = await prisma.espacio.create({
      data: {
        nom_esp,
        tipo,
        capacidad: Number(capacidad),
        bloque,
        piso,
        estado: ESTADOS.includes(estado) ? estado : 'DISPONIBLE',
      },
    });
    res.status(201).json({ mensaje: 'Espacio creado exitosamente', espacio: nuevoEspacio });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear el espacio.' });
  }
});

// ==========================================
// OBTENER TODOS LOS ESPACIOS (CUALQUIER USUARIO AUTENTICADO)
// ==========================================
router.get('/', verificarToken, async (req, res) => {
  try {
    const espacios = await prisma.espacio.findMany({ orderBy: { nom_esp: 'asc' } });
    res.json(espacios);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los espacios.' });
  }
});

// ==========================================
// EDITAR ESPACIO / ESTADO / MANTENIMIENTO (SOLO ADMINISTRADORES)
// ==========================================
router.put('/:id', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const id_esp = Number(req.params.id);
  const { nom_esp, tipo, capacidad, bloque, piso, estado } = req.body;

  if (tipo !== undefined && !TIPOS.includes(tipo)) {
    return res.status(400).json({ error: 'Tipo de espacio inválido.' });
  }
  if (estado !== undefined && !ESTADOS.includes(estado)) {
    return res.status(400).json({ error: 'Estado de espacio inválido.' });
  }

  try {
    if (bloque !== undefined || piso !== undefined) {
      const actual = await prisma.espacio.findUnique({ where: { id_esp } });
      if (!actual) {
        return res.status(404).json({ error: 'Espacio no encontrado.' });
      }
      const bloqueFinal = bloque !== undefined ? bloque : actual.bloque;
      const pisoFinal = piso !== undefined ? piso : actual.piso;
      if (!bloqueYPisoValidos(bloqueFinal, pisoFinal)) {
        return res.status(400).json({ error: 'Bloque o piso inválido para el espacio.' });
      }
    }

    const actualizado = await prisma.espacio.update({
      where: { id_esp },
      data: {
        ...(nom_esp !== undefined && { nom_esp }),
        ...(tipo !== undefined && { tipo }),
        ...(capacidad !== undefined && { capacidad: Number(capacidad) }),
        ...(bloque !== undefined && { bloque }),
        ...(piso !== undefined && { piso }),
        ...(estado !== undefined && { estado }),
      },
    });
    res.json({ mensaje: 'Espacio actualizado', espacio: actualizado });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Espacio no encontrado.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el espacio.' });
  }
});

// ==========================================
// ELIMINAR ESPACIO (SOLO ADMINISTRADORES)
// ==========================================
router.delete('/:id', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const id_esp = Number(req.params.id);

  try {
    await prisma.espacio.delete({ where: { id_esp } });
    res.json({ mensaje: 'Espacio eliminado' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Espacio no encontrado.' });
    }
    if (error.code === 'P2003') {
      return res
        .status(409)
        .json({ error: 'No se puede eliminar: el espacio tiene reservas u horarios asociados.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el espacio.' });
  }
});

module.exports = router;
