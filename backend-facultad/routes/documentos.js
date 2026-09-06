const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = express.Router();
const prisma = new PrismaClient();

// ==========================================
// COMPARTIR UN DOCUMENTO EN LA TUTORÍA (Docentes y Admins)
// ==========================================
router.post('/', verificarToken, verificarRol(['DOCENTE', 'ADMINISTRADOR']), async (req, res) => {
  const { id_rev, url_archivo, nom_archivo } = req.body;

  try {
    const nuevoDocumento = await prisma.documento.create({
      data: {
        id_rev,
        url_archivo, // En un sistema real, aquí guardarías el link de Supabase Storage, AWS S3 o Drive
        nom_archivo
      }
    });

    res.status(201).json({
      mensaje: 'Documento compartido exitosamente.',
      documento: nuevoDocumento
    });
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
    // REGLA DE NEGOCIO: Si es un estudiante, validar que haya asistido
    if (rol_usuario === 'ESTUDIANTE') {
      const asistio = await prisma.asistencia.findUnique({
        where: {
          id_rev_id_est: { // Usa la clave compuesta (@@unique) definida en el schema.prisma
            id_rev: parseInt(id_rev),
            id_est: id_usuario
          }
        }
      });

      // Si no existe el registro de asistencia, bloqueamos el acceso
      if (!asistio) {
        return res.status(403).json({ 
          error: 'Acceso denegado. Solo los estudiantes que escanearon el código QR de asistencia pueden ver este material.' 
        });
      }
    }

    // Si pasó la validación (o si es Docente/Admin), devolvemos los archivos
    const documentos = await prisma.documento.findMany({
      where: { id_rev: parseInt(id_rev) },
      orderBy: { fecha_subida: 'desc' }
    });

    res.json(documentos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los documentos.' });
  }
});

module.exports = router;