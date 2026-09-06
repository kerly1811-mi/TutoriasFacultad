const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = express.Router();
const prisma = new PrismaClient();

// ==========================================
// REGISTRAR ASISTENCIA (SIMULA EL ESCANEO DEL MÓVIL)
// ==========================================
// Permitimos que estudiantes (e incluso administradores para pruebas) registren asistencia
router.post('/registrar', verificarToken, verificarRol(['ESTUDIANTE', 'ADMINISTRADOR']), async (req, res) => {
  const id_estudiante = req.usuario.id; // Obtenemos el ID del estudiante desde su token JWT
  const { qr_token } = req.body;

  try {
    // 1. Buscar la reserva asociada a ese código QR exacto
    const reserva = await prisma.reserva.findUnique({
      where: { qr_token }
    });

    if (!reserva) {
      return res.status(404).json({ error: 'Código QR inválido o tutoría no encontrada.' });
    }

    // 2. Registrar la asistencia vinculando al estudiante con la reserva
    const nuevaAsistencia = await prisma.asistencia.create({
      data: {
        id_rev: reserva.id_rev,
        id_est: id_estudiante,
        validado_qr: true
      }
    });

    res.status(201).json({
      mensaje: 'Asistencia registrada correctamente.',
      asistencia: nuevaAsistencia
    });

  } catch (error) {
    console.error(error);
    // Prisma arroja el código P2002 cuando se viola una restricción única (@@unique en nuestro schema)
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya registraste tu asistencia para esta tutoría previamente.' });
    }
    res.status(500).json({ error: 'Error al procesar el escaneo del código QR.' });
  }
});

// ==========================================
// VER ASISTENTES A UNA TUTORÍA (Para Docentes y Laboratoristas)
// ==========================================
router.get('/reserva/:id_rev', verificarToken, async (req, res) => {
  const { id_rev } = req.params;

  try {
    const listado = await prisma.asistencia.findMany({
      where: { id_rev: parseInt(id_rev) },
      include: {
        estudiante: {
          select: { nombres: true, apellidos: true, cedula: true }
        }
      },
      orderBy: { hora_registro: 'asc' }
    });

    res.json(listado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el listado de asistencia.' });
  }
});

module.exports = router;