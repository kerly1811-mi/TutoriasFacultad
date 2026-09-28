const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { cedulaValida, correoValido } = require('../utils/validadores');
const { enviarRecuperacionPassword } = require('../utils/mailer');

const router = express.Router();
const prisma = require('../lib/prisma');

// ==========================================
// REGISTRO DE USUARIO
// ==========================================
router.post('/registro', async (req, res) => {
  const cedula = (req.body.cedula || '').trim();
  const nombres = (req.body.nombres || '').trim();
  const apellidos = (req.body.apellidos || '').trim();
  const correo = (req.body.correo || '').trim();
  const { password } = req.body;
  const rol = 'ESTUDIANTE';

  if (!cedula || !nombres || !apellidos || !correo || !password) {
    return res.status(400).json({ error: 'Faltan datos obligatorios.' });
  }
  if (!cedulaValida(cedula)) {
    return res.status(400).json({ error: 'La cédula ingresada no es válida.' });
  }
  if (!correoValido(correo)) {
    return res.status(400).json({ error: 'El correo ingresado no es válido.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  }
  if (nombres.length > 100 || apellidos.length > 100 || correo.length > 100) {
    return res.status(400).json({ error: 'Alguno de los campos supera la longitud permitida.' });
  }

  try {
    const usuarioExistente = await prisma.usuario.findFirst({
      where: {
        OR: [{ cedula }, { correo }]
      }
    });

    if (usuarioExistente) {
      return res.status(400).json({ error: 'La cédula o el correo ya están registrados.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const nuevoUsuario = await prisma.usuario.create({
      data: {
        cedula,
        nombres,
        apellidos,
        correo,
        password: hashedPassword,
        rol,
        activo: true,
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
    const usuario = await prisma.usuario.findUnique({
      where: { correo }
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    if (!usuario.activo) {
      return res.status(403).json({ error: 'Tu cuenta está deshabilitada. Contacta a un administrador.' });
    }

    const passwordValido = await bcrypt.compare(password, usuario.password);
    if (!passwordValido) {
      return res.status(401).json({ error: 'Contraseña incorrecta.' });
    }

    const token = jwt.sign(
      { id: usuario.id_usr, rol: usuario.rol },
      process.env.JWT_SECRET || 'secret_jwt_key_facultad_2026',
      { expiresIn: '8h' }
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

// ==========================================
// SOLICITAR RECUPERACIÓN DE CONTRASEÑA
// ==========================================
router.post('/olvide-password', async (req, res) => {
  const correo = (req.body.correo || '').trim().toLowerCase();

  if (!correo) {
    return res.status(400).json({ error: 'Por favor ingresa tu correo electrónico.' });
  }
  if (!correoValido(correo)) {
    return res.status(400).json({ error: 'El formato de correo electrónico no es válido.' });
  }

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { correo }
    });

    if (!usuario) {
      return res.status(404).json({ error: 'No encontramos ningún usuario registrado con ese correo electrónico.' });
    }
    if (!usuario.activo) {
      return res.status(403).json({ error: 'Tu cuenta se encuentra deshabilitada. Contacta a un administrador.' });
    }

    const token = jwt.sign(
      { id: usuario.id_usr, correo: usuario.correo, tipo: 'RECUPERAR_PASSWORD' },
      process.env.JWT_SECRET || 'secret_jwt_key_facultad_2026',
      { expiresIn: '15m' }
    );

    const resultadoEnvio = await enviarRecuperacionPassword({
      correo: usuario.correo,
      nombres: `${usuario.nombres} ${usuario.apellidos}`.trim(),
      token,
    });

    res.json({
      mensaje: 'Hemos enviado un correo con instrucciones para restablecer tu contraseña. Revisa tu bandeja de entrada o spam.',
      token,
      correo: usuario.correo,
      correoEnviado: resultadoEnvio.enviado,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al procesar la solicitud de recuperación.' });
  }
});

// ==========================================
// RESTABLECER CONTRASEÑA CON TOKEN
// ==========================================
router.post('/restablecer-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Faltan datos obligatorios (token y nueva contraseña).' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_jwt_key_facultad_2026');

    if (decoded.tipo !== 'RECUPERAR_PASSWORD') {
      return res.status(400).json({ error: 'El token proporcionado no es válido para restablecer contraseña.' });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id_usr: decoded.id }
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await prisma.usuario.update({
      where: { id_usr: usuario.id_usr },
      data: { password: hashedPassword }
    });

    res.json({
      mensaje: 'Tu contraseña ha sido restablecida exitosamente. Ya puedes iniciar sesión.',
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'El enlace o token de recuperación ha expirado. Por favor solicita uno nuevo.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(400).json({ error: 'Token de recuperación inválido o alterado.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error interno al restablecer la contraseña.' });
  }
});

module.exports = router;
