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

const GESTION = ['ADMINISTRADOR', 'LABORATORISTA'];

// ==========================================
// CREAR ESPACIO (ADMINISTRADOR / LABORATORISTA)
// ==========================================
router.post('/', verificarToken, verificarRol(GESTION), async (req, res) => {
  const nom_esp = (req.body.nom_esp || '').trim();
  const { tipo, capacidad, bloque, piso, estado } = req.body;

  if (!nom_esp || !TIPOS.includes(tipo) || !capacidad) {
    return res.status(400).json({ error: 'Datos del espacio incompletos o inválidos.' });
  }
  if (nom_esp.length > 100) {
    return res.status(400).json({ error: 'El nombre del espacio supera la longitud permitida.' });
  }
  if (!Number.isInteger(Number(capacidad)) || Number(capacidad) <= 0) {
    return res.status(400).json({ error: 'La capacidad debe ser un número entero positivo.' });
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
// OBTENER TODOS LOS ESPACIOS (CUALQUIER USUARIO AUTENTICADO)  ?incluirInactivos=1
// Sin el query param, solo devuelve espacios activos (para reservar, disponibilidad, etc).
// ==========================================
router.get('/', verificarToken, async (req, res) => {
  const incluirInactivos = req.query.incluirInactivos === '1' || req.query.incluirInactivos === 'true';
  try {
    const espacios = await prisma.espacio.findMany({
      where: incluirInactivos ? undefined : { activo: true },
      orderBy: { nom_esp: 'asc' },
    });
    res.json(espacios);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los espacios.' });
  }
});

// ==========================================
// EDITAR ESPACIO / ESTADO / MANTENIMIENTO (ADMINISTRADOR / LABORATORISTA)
// ==========================================
router.put('/:id', verificarToken, verificarRol(GESTION), async (req, res) => {
  const id_esp = Number(req.params.id);
  const { tipo, capacidad, bloque, piso, estado } = req.body;
  const nom_esp = req.body.nom_esp !== undefined ? req.body.nom_esp.trim() : undefined;

  if (nom_esp !== undefined && (!nom_esp || nom_esp.length > 100)) {
    return res.status(400).json({ error: 'Nombre del espacio inválido.' });
  }
  if (tipo !== undefined && !TIPOS.includes(tipo)) {
    return res.status(400).json({ error: 'Tipo de espacio inválido.' });
  }
  if (capacidad !== undefined && (!Number.isInteger(Number(capacidad)) || Number(capacidad) <= 0)) {
    return res.status(400).json({ error: 'La capacidad debe ser un número entero positivo.' });
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
// HABILITAR / DESHABILITAR ESPACIO (ADMINISTRADOR / LABORATORISTA)
// No se elimina: un espacio deshabilitado deja de ofrecerse para reservar.
// ==========================================
router.patch('/:id/estado', verificarToken, verificarRol(GESTION), async (req, res) => {
  const id_esp = Number(req.params.id);
  const { activo } = req.body;

  if (typeof activo !== 'boolean') {
    return res.status(400).json({ error: 'Falta indicar el nuevo estado (activo).' });
  }

  try {
    const actualizado = await prisma.espacio.update({ where: { id_esp }, data: { activo } });
    res.json({ mensaje: activo ? 'Espacio habilitado' : 'Espacio deshabilitado', espacio: actualizado });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Espacio no encontrado.' });
    console.error(error);
    res.status(500).json({ error: 'Error al cambiar el estado del espacio.' });
  }
});

module.exports = router;
