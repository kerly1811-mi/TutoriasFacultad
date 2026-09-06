const express = require('express');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = express.Router();
const prisma = new PrismaClient();

// ==========================================
// CREAR UNA SOLICITUD DE RESERVA / TUTORÍA
// ==========================================
router.post('/', verificarToken, async (req, res) => {
  // El solicitante se toma automáticamente del token JWT por seguridad
  const id_usr_solicitante = req.usuario.id;
  const { id_esp, id_doc_asignado, fecha, hor_ini, hor_fin, motivo } = req.body;

  try {
    // 1. Generar un identificador único que servirá para armar el Código QR
    const qr_token = crypto.randomUUID();

    // 2. Crear la reserva en la base de datos
    const nuevaReserva = await prisma.reserva.create({
      data: {
        id_esp,
        id_usr_solicitante,
        id_doc_asignado,
        // Prisma requiere objetos Date válidos
        fecha: new Date(fecha),
        hor_ini: new Date(hor_ini),
        hor_fin: new Date(hor_fin),
        motivo,
        qr_token,
        estado: 'PENDIENTE' // Estado por defecto
      }
    });

    res.status(201).json({
      mensaje: 'Reserva solicitada exitosamente',
      reserva: nuevaReserva
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear la reserva.' });
  }
});

// ==========================================
// OBTENER RESERVAS (Para ver disponibilidad)
// ==========================================
router.get('/', verificarToken, async (req, res) => {
  try {
    // Traemos las reservas e incluimos los datos del espacio y del docente
    const reservas = await prisma.reserva.findMany({
      include: {
        espacio: { select: { nom_esp: true, tipo: true } },
        docente_asignado: { select: { nombres: true, apellidos: true } }
      },
      orderBy: { fecha: 'asc' }
    });
    res.json(reservas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener las reservas.' });
  }
});

module.exports = router;