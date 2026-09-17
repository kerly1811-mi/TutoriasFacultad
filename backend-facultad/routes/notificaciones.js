const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verificarToken } = require('../middlewares/authMiddleware');

const router = express.Router();
const prisma = new PrismaClient();

// Crea una notificación para un usuario. La usan otras rutas (solicitudes),
// no está expuesta como endpoint propio.
async function crearNotificacion({ id_usr, tipo, mensaje, id_sol = null }) {
  return prisma.notificacion.create({ data: { id_usr, tipo, mensaje, id_sol } });
}

// ==========================================
// LISTAR MIS NOTIFICACIONES (más recientes primero)
// ==========================================
router.get('/', verificarToken, async (req, res) => {
  try {
    const notificaciones = await prisma.notificacion.findMany({
      where: { id_usr: req.usuario.id },
      orderBy: { creado_en: 'desc' },
      take: 30,
    });
    res.json(notificaciones);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener las notificaciones.' });
  }
});

// ==========================================
// MARCAR UNA COMO LEÍDA
// ==========================================
router.patch('/:id/leer', verificarToken, async (req, res) => {
  const id_not = Number(req.params.id);
  try {
    const notif = await prisma.notificacion.findUnique({ where: { id_not } });
    if (!notif || notif.id_usr !== req.usuario.id) {
      return res.status(404).json({ error: 'Notificación no encontrada.' });
    }
    const actualizada = await prisma.notificacion.update({ where: { id_not }, data: { leida: true } });
    res.json(actualizada);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar la notificación.' });
  }
});

// ==========================================
// MARCAR TODAS COMO LEÍDAS
// ==========================================
router.patch('/leer-todas', verificarToken, async (req, res) => {
  try {
    await prisma.notificacion.updateMany({
      where: { id_usr: req.usuario.id, leida: false },
      data: { leida: true },
    });
    res.json({ mensaje: 'Notificaciones marcadas como leídas.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar las notificaciones.' });
  }
});

module.exports = router;
module.exports.crearNotificacion = crearNotificacion;
