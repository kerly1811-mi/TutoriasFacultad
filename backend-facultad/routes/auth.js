const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// ==========================================
// REGISTRO DE USUARIO
// ==========================================
router.post('/registro', async (req, res) => {
  // El registro público SIEMPRE crea estudiantes. Cualquier `rol` que llegue en
  // el body se ignora. Docentes, laboratoristas y administradores los da de alta
  // un administrador desde POST /api/usuarios.
  const { cedula, nombres, apellidos, correo, password } = req.body;
  const rol = 'ESTUDIANTE';

  try {
    // 1. Verificar si el usuario ya existe (por cédula o correo)
    const usuarioExistente = await prisma.usuario.findFirst({
      where: {
        OR: [{ cedula }, { correo }]
      }
    });

    if (usuarioExistente) {
      return res.status(400).json({ error: 'La cédula o el correo ya están registrados.' });
    }

    // 2. Encriptar la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Crear el usuario en la base de datos
    const nuevoUsuario = await prisma.usuario.create({
      data: {
        cedula,
        nombres,
        apellidos,
        correo,
        password: hashedPassword,
        rol
      }
    });

    res.status(201).json({
      mensaje: 'Usuario registrado exitosamente',
      usuario: {
        id: nuevoUsuario.id_usr,
        nombres: nuevoUsuario.nombres,
        rol: nuevoUsuario.rol
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor al registrar el usuario.' });
  }
});

// ==========================================
// INICIO DE SESIÓN (LOGIN)
// ==========================================
router.post('/login', async (req, res) => {
  const { correo, password } = req.body;

  try {
    // 1. Buscar al usuario por correo
    const usuario = await prisma.usuario.findUnique({
      where: { correo }
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    // 2. Verificar la contraseña
    const passwordValido = await bcrypt.compare(password, usuario.password);
    if (!passwordValido) {
      return res.status(401).json({ error: 'Contraseña incorrecta.' });
    }

    // 3. Generar el Token JWT
    // Se incluye el ID y el ROL en el payload para usarlos luego en el control de acceso
    const token = jwt.sign(
      { id: usuario.id_usr, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '8h' } // El token expirará en 8 horas
    );

    res.json({
      mensaje: 'Inicio de sesión exitoso',
      token,
      usuario: {
        id: usuario.id_usr,
        nombres: usuario.nombres,
        rol: usuario.rol
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor al iniciar sesión.' });
  }
});

module.exports = router;