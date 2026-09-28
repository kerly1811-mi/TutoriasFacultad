const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');
const { cedulaValida, correoValido } = require('../utils/validadores');
const { enviarCredencialesNuevoUsuario } = require('../utils/mailer');

const router = express.Router();
const prisma = new PrismaClient();

const ROLES_VALIDOS = ['ADMINISTRADOR', 'DOCENTE', 'ESTUDIANTE', 'LABORATORISTA'];

// ==========================================
// CREAR USUARIO CON ROL (SOLO ADMINISTRADORES)
// ==========================================
router.post('/', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const cedula = (req.body.cedula || '').trim();
  const nombres = (req.body.nombres || '').trim();
  const apellidos = (req.body.apellidos || '').trim();
  const correo = (req.body.correo || '').trim().toLowerCase();
  const { password, rol } = req.body;

  if (!ROLES_VALIDOS.includes(rol)) {
    return res.status(400).json({ error: 'Rol no válido.' });
  }
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
    const existente = await prisma.usuario.findFirst({
      where: { OR: [{ cedula }, { correo }] },
    });
    if (existente) {
      return res.status(400).json({ error: 'La cédula o el correo ya están registrados.' });
    }

    const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(10));

    const nuevo = await prisma.usuario.create({
      data: { cedula, nombres, apellidos, correo, password: hashedPassword, rol, activo: true },
    });

    // Envío automático de credenciales al correo del nuevo usuario
    const resultadoEnvio = await enviarCredencialesNuevoUsuario({
      correo: nuevo.correo,
      nombres: `${nuevo.nombres} ${nuevo.apellidos}`.trim(),
      rol: nuevo.rol,
      password,
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
      correoEnviado: resultadoEnvio.enviado,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear el usuario.' });
  }
});

// ==========================================
// LISTAR USUARIOS (ADMIN y LABORATORISTA)  ?rol=DOCENTE  ?incluirInactivos=1
// El laboratorista lo necesita para asociar un docente a un horario de clase
// (por eso, sin ?incluirInactivos=1, solo devuelve usuarios activos).
// ==========================================
router.get('/', verificarToken, verificarRol(['ADMINISTRADOR', 'LABORATORISTA']), async (req, res) => {
  const { rol } = req.query;
  const incluirInactivos = req.query.incluirInactivos === '1' || req.query.incluirInactivos === 'true';

  try {
    const usuarios = await prisma.usuario.findMany({
      where: {
        ...(rol && { rol }),
        ...(!incluirInactivos && { activo: true }),
      },
      select: {
        id_usr: true,
        cedula: true,
        nombres: true,
        apellidos: true,
        correo: true,
        rol: true,
        activo: true,
      },
      orderBy: [{ rol: 'asc' }, { apellidos: 'asc' }],
    });
    res.json(usuarios);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los usuarios.' });
  }
});

// ==========================================
// HABILITAR / DESHABILITAR USUARIO (SOLO ADMINISTRADORES)
// No se elimina: un usuario deshabilitado no puede iniciar sesión.
// ==========================================
router.patch('/:id/estado', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const id_usr = Number(req.params.id);
  const { activo } = req.body;

  if (typeof activo !== 'boolean') {
    return res.status(400).json({ error: 'Falta indicar el nuevo estado (activo).' });
  }
  if (id_usr === req.usuario.id) {
    return res.status(400).json({ error: 'No puedes deshabilitar tu propia cuenta.' });
  }

  try {
    const actualizado = await prisma.usuario.update({
      where: { id_usr },
      data: { activo },
      select: {
        id_usr: true,
        cedula: true,
        nombres: true,
        apellidos: true,
        correo: true,
        rol: true,
        activo: true,
      },
    });
    res.json({ mensaje: activo ? 'Usuario habilitado' : 'Usuario deshabilitado', usuario: actualizado });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Usuario no encontrado.' });
    console.error(error);
    res.status(500).json({ error: 'Error al cambiar el estado del usuario.' });
  }
});

module.exports = router;
