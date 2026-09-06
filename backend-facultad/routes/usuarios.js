const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = express.Router();
const prisma = new PrismaClient();

const ROLES_VALIDOS = ['ADMINISTRADOR', 'DOCENTE', 'ESTUDIANTE', 'LABORATORISTA'];

// ==========================================
// CREAR USUARIO CON ROL (SOLO ADMINISTRADORES)
// ==========================================
router.post('/', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const { cedula, nombres, apellidos, correo, password, rol } = req.body;

  if (!ROLES_VALIDOS.includes(rol)) {
    return res.status(400).json({ error: 'Rol no válido.' });
  }
  if (!cedula || !nombres || !apellidos || !correo || !password) {
    return res.status(400).json({ error: 'Faltan datos obligatorios.' });
  }

  try {
    const existente = await prisma.usuario.findFirst({
      where: { OR: [{ cedula }, { correo }] },
    });
    if (existente) {
      return res.status(400).json({ error: 'La cédula o el correo ya están registrados.' });
    }

    const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(10));

    const nuevo = await prisma.usuario.create({
      data: { cedula, nombres, apellidos, correo, password: hashedPassword, rol },
    });

    res.status(201).json({
      mensaje: 'Usuario creado exitosamente',
      usuario: {
        id: nuevo.id_usr,
        cedula: nuevo.cedula,
        nombres: nuevo.nombres,
        apellidos: nuevo.apellidos,
        correo: nuevo.correo,
        rol: nuevo.rol,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear el usuario.' });
  }
});

// ==========================================
// LISTAR USUARIOS (ADMIN y LABORATORISTA)  ?rol=DOCENTE
// El laboratorista lo necesita para asociar un docente a un horario de clase.
// ==========================================
router.get('/', verificarToken, verificarRol(['ADMINISTRADOR', 'LABORATORISTA']), async (req, res) => {
  const { rol } = req.query;

  try {
    const usuarios = await prisma.usuario.findMany({
      where: rol ? { rol } : undefined,
      select: {
        id_usr: true,
        cedula: true,
        nombres: true,
        apellidos: true,
        correo: true,
        rol: true,
      },
      orderBy: [{ rol: 'asc' }, { apellidos: 'asc' }],
    });
    res.json(usuarios);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los usuarios.' });
  }
});

module.exports = router;
