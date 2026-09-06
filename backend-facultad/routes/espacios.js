const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = express.Router();
const prisma = new PrismaClient();

// ==========================================
// CREAR UN ESPACIO (SOLO ADMINISTRADORES)
// ==========================================
router.post('/', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const { nom_esp, tipo, capacidad, ubicacion } = req.body;

  try {
    const nuevoEspacio = await prisma.espacio.create({
      data: {
        nom_esp,
        tipo, // Debe ser "AULA" o "LABORATORIO"
        capacidad,
        ubicacion
      }
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
    const espacios = await prisma.espacio.findMany();
    res.json(espacios);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los espacios.' });
  }
});

module.exports = router;