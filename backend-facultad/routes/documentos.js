const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = express.Router();
const prisma = new PrismaClient();

const CARPETA_SUBIDAS = path.join(__dirname, '..', 'uploads', 'documentos');
fs.mkdirSync(CARPETA_SUBIDAS, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CARPETA_SUBIDAS),
  filename: (req, file, cb) => {
    const sufijo = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${sufijo}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } }); // 25 MB por archivo

// ==========================================
// SUBIR UN ARCHIVO A LA TUTORÍA (Docentes y Admins)
// multipart/form-data: campo "archivo" + campo "id_rev"
// ==========================================
router.post('/subir', verificarToken, verificarRol(['DOCENTE', 'ADMINISTRADOR']), upload.single('archivo'), async (req, res) => {
  const { id_rev } = req.body;
  if (!id_rev || !req.file) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Faltan datos (reserva y archivo).' });
  }

  try {
    const reserva = await prisma.reserva.findUnique({ where: { id_rev: Number(id_rev) } });
    if (!reserva) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Reserva no encontrada.' });
    }
    if (req.usuario.rol === 'DOCENTE' && reserva.id_usr_solicitante !== req.usuario.id) {
      fs.unlink(req.file.path, () => {});
      return res.status(403).json({ error: 'No puedes subir material a esta tutoría.' });
    }

    const extension = path.extname(req.file.originalname).slice(1).toLowerCase() || null;
    const nuevoDocumento = await prisma.documento.create({
      data: {
        id_rev: Number(id_rev),
        nom_archivo: req.file.originalname,
        url_archivo: `/uploads/documentos/${req.file.filename}`,
        extension,
        tamano_bytes: req.file.size,
      },
    });

    res.status(201).json({ mensaje: 'Archivo subido correctamente.', documento: nuevoDocumento });
  } catch (error) {
    fs.unlink(req.file.path, () => {});
    console.error(error);
    res.status(500).json({ error: 'Error al subir el archivo.' });
  }
});

// ==========================================
// COMPARTIR UN ENLACE (sin archivo físico) -- Docentes y Admins
// ==========================================
router.post('/', verificarToken, verificarRol(['DOCENTE', 'ADMINISTRADOR']), async (req, res) => {
  const { id_rev, url_archivo, nom_archivo } = req.body;
  if (!id_rev || !url_archivo || !nom_archivo) {
    return res.status(400).json({ error: 'Faltan datos (reserva, nombre y enlace).' });
  }

  try {
    const nuevoDocumento = await prisma.documento.create({
      data: { id_rev: Number(id_rev), url_archivo, nom_archivo },
    });
    res.status(201).json({ mensaje: 'Documento compartido exitosamente.', documento: nuevoDocumento });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar el documento.' });
  }
});

// ==========================================
// OBTENER MATERIAL DE LA TUTORÍA (VALIDA ASISTENCIA DEL ESTUDIANTE)
// ==========================================
router.get('/reserva/:id_rev', verificarToken, async (req, res) => {
  const { id_rev } = req.params;
  const id_usuario = req.usuario.id;
  const rol_usuario = req.usuario.rol;

  try {
    if (rol_usuario === 'ESTUDIANTE') {
      const asistio = await prisma.asistencia.findUnique({
        where: { id_rev_id_est: { id_rev: parseInt(id_rev), id_est: id_usuario } },
      });
      if (!asistio) {
        return res.status(403).json({
          error: 'Acceso denegado. Solo los estudiantes que escanearon el código QR de asistencia pueden ver este material.',
        });
      }
    }

    const documentos = await prisma.documento.findMany({
      where: { id_rev: parseInt(id_rev) },
      orderBy: { fecha_subida: 'desc' },
    });

    res.json(documentos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los documentos.' });
  }
});

// ==========================================
// ELIMINAR UN DOCUMENTO (docente dueño de la tutoría o admin)
// ==========================================
router.delete('/:id', verificarToken, verificarRol(['DOCENTE', 'ADMINISTRADOR']), async (req, res) => {
  const id_docu = Number(req.params.id);

  try {
    const documento = await prisma.documento.findUnique({
      where: { id_docu },
      include: { reserva: { select: { id_usr_solicitante: true } } },
    });
    if (!documento) return res.status(404).json({ error: 'Documento no encontrado.' });
    if (req.usuario.rol === 'DOCENTE' && documento.reserva.id_usr_solicitante !== req.usuario.id) {
      return res.status(403).json({ error: 'No puedes eliminar este documento.' });
    }

    await prisma.documento.delete({ where: { id_docu } });

    if (documento.url_archivo.startsWith('/uploads/')) {
      const rutaLocal = path.join(__dirname, '..', documento.url_archivo);
      fs.unlink(rutaLocal, () => {}); // best-effort: si ya no existe, no pasa nada
    }

    res.json({ mensaje: 'Documento eliminado.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el documento.' });
  }
});

module.exports = router;
