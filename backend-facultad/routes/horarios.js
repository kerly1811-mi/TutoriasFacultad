const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');
const { DIAS, aMinutos, esHoraValida, seSolapan } = require('../utils/tiempo');

const router = express.Router();
const prisma = new PrismaClient();

const GESTION = ['LABORATORISTA', 'ADMINISTRADOR'];

const incluir = {
  espacio: { select: { nom_esp: true, tipo: true } },
  docente: { select: { nombres: true, apellidos: true } },
};

// Valida el cuerpo de un horario. Devuelve un string de error o null.
function validar(body) {
  const { id_esp, nombre_curso, dia_semana, hora_ini, hora_fin } = body;
  if (!id_esp || !nombre_curso || !dia_semana || !hora_ini || !hora_fin) {
    return 'Faltan datos obligatorios.';
  }
  if (!DIAS.includes(dia_semana)) return 'Día de la semana inválido.';
  if (!esHoraValida(hora_ini) || !esHoraValida(hora_fin)) return 'Hora inválida (formato HH:MM).';
  if (aMinutos(hora_fin) <= aMinutos(hora_ini)) return 'La hora de fin debe ser posterior a la de inicio.';
  return null;
}

// Choque con otra clase del mismo espacio y día (excluyendo `exceptoId`).
async function chocaConOtraClase({ id_esp, dia_semana, hora_ini, hora_fin }, exceptoId) {
  const otras = await prisma.horarioClase.findMany({
    where: { id_esp: Number(id_esp), dia_semana, ...(exceptoId && { NOT: { id_hor: exceptoId } }) },
  });
  const ini = aMinutos(hora_ini);
  const fin = aMinutos(hora_fin);
  return otras.some((h) => seSolapan(ini, fin, aMinutos(h.hora_ini), aMinutos(h.hora_fin)));
}

// ==========================================
// LISTAR HORARIOS   ?espacio=ID
// ==========================================
router.get('/', verificarToken, async (req, res) => {
  const { espacio } = req.query;
  try {
    const horarios = await prisma.horarioClase.findMany({
      where: espacio ? { id_esp: Number(espacio) } : undefined,
      include: incluir,
      orderBy: [{ dia_semana: 'asc' }, { hora_ini: 'asc' }],
    });
    res.json(horarios);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los horarios.' });
  }
});

// ==========================================
// CREAR HORARIO (LABORATORISTA / ADMIN)
// ==========================================
router.post('/', verificarToken, verificarRol(GESTION), async (req, res) => {
  const err = validar(req.body);
  if (err) return res.status(400).json({ error: err });

  const { id_esp, nombre_curso, id_doc, dia_semana, hora_ini, hora_fin } = req.body;

  try {
    if (await chocaConOtraClase({ id_esp, dia_semana, hora_ini, hora_fin })) {
      return res.status(409).json({ error: 'Ese horario se cruza con otra clase en la misma aula.' });
    }
    const horario = await prisma.horarioClase.create({
      data: {
        id_esp: Number(id_esp),
        nombre_curso,
        id_doc: id_doc ? Number(id_doc) : null,
        dia_semana,
        hora_ini,
        hora_fin,
      },
      include: incluir,
    });
    res.status(201).json({ mensaje: 'Horario creado', horario });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear el horario.' });
  }
});

// ==========================================
// EDITAR HORARIO (LABORATORISTA / ADMIN)
// ==========================================
router.put('/:id', verificarToken, verificarRol(GESTION), async (req, res) => {
  const id_hor = Number(req.params.id);
  const err = validar(req.body);
  if (err) return res.status(400).json({ error: err });

  const { id_esp, nombre_curso, id_doc, dia_semana, hora_ini, hora_fin } = req.body;

  try {
    if (await chocaConOtraClase({ id_esp, dia_semana, hora_ini, hora_fin }, id_hor)) {
      return res.status(409).json({ error: 'Ese horario se cruza con otra clase en la misma aula.' });
    }
    const horario = await prisma.horarioClase.update({
      where: { id_hor },
      data: {
        id_esp: Number(id_esp),
        nombre_curso,
        id_doc: id_doc ? Number(id_doc) : null,
        dia_semana,
        hora_ini,
        hora_fin,
      },
      include: incluir,
    });
    res.json({ mensaje: 'Horario actualizado', horario });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Horario no encontrado.' });
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el horario.' });
  }
});

// ==========================================
// ELIMINAR HORARIO (LABORATORISTA / ADMIN)
// ==========================================
router.delete('/:id', verificarToken, verificarRol(GESTION), async (req, res) => {
  try {
    await prisma.horarioClase.delete({ where: { id_hor: Number(req.params.id) } });
    res.json({ mensaje: 'Horario eliminado' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Horario no encontrado.' });
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el horario.' });
  }
});

module.exports = router;
