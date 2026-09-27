const express = require('express');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');
const { DIAS, aMinutos, esHoraValida, seSolapan, errorDeJornada } = require('../utils/tiempo');
const { nombreCursoDe } = require('../utils/cursos');

const router = express.Router();
const prisma = require('../lib/prisma');

const GESTION = ['LABORATORISTA', 'ADMINISTRADOR'];

const incluir = {
  espacio: { select: { nom_esp: true, tipo: true } },
  docente: { select: { nombres: true, apellidos: true } },
  paralelo: {
    select: {
      id_par: true,
      nom_par: true,
      materia: { select: { nom_mat: true } },
      nivel: { select: { nom_niv: true, carrera: { select: { nom_car: true } } } },
    },
  },
};

const incluirParaleloCompleto = {
  materia: true,
  nivel: { include: { carrera: true } },
};

// Si el bloque trae `id_par`, el curso y el docente salen del paralelo
// (así no se escriben a mano ni quedan desalineados). Devuelve los datos a guardar
// o { error }.
async function datosDelBloque(body) {
  const { id_esp, id_par, dia_semana, hora_ini, hora_fin } = body;
  if (id_par) {
    const paralelo = await prisma.paralelo.findUnique({
      where: { id_par: Number(id_par) },
      include: incluirParaleloCompleto,
    });
    if (!paralelo) return { error: 'Paralelo no encontrado.' };
    return {
      id_esp: Number(id_esp),
      id_par: paralelo.id_par,
      nombre_curso: nombreCursoDe(paralelo),
      id_doc: paralelo.id_doc,
      dia_semana,
      hora_ini,
      hora_fin,
    };
  }
  return {
    id_esp: Number(id_esp),
    id_par: null,
    nombre_curso: body.nombre_curso,
    id_doc: body.id_doc ? Number(body.id_doc) : null,
    dia_semana,
    hora_ini,
    hora_fin,
  };
}

// Valida el cuerpo de un horario. Devuelve un string de error o null.
function validar(body) {
  const { id_esp, id_par, nombre_curso, dia_semana, hora_ini, hora_fin } = body;
  if (!id_esp || !(id_par || nombre_curso) || !dia_semana || !hora_ini || !hora_fin) {
    return 'Faltan datos obligatorios (aula, paralelo, día y horas).';
  }
  if (!DIAS.includes(dia_semana)) return 'Día de la semana inválido.';
  if (!esHoraValida(hora_ini) || !esHoraValida(hora_fin)) return 'Hora inválida (formato HH:MM).';
  if (aMinutos(hora_fin) <= aMinutos(hora_ini)) return 'La hora de fin debe ser posterior a la de inicio.';
  return errorDeJornada({ dia: dia_semana, hora_ini, hora_fin });
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
// LISTAR HORARIOS   ?espacio=ID  ?id_par=ID
// ==========================================
router.get('/', verificarToken, async (req, res) => {
  const { espacio, id_par } = req.query;
  try {
    const horarios = await prisma.horarioClase.findMany({
      where: {
        ...(espacio && { id_esp: Number(espacio) }),
        ...(id_par && { id_par: Number(id_par) }),
      },
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

  try {
    const datos = await datosDelBloque(req.body);
    if (datos.error) return res.status(404).json({ error: datos.error });
    if (await chocaConOtraClase(datos)) {
      return res.status(409).json({ error: 'Ese horario se cruza con otra clase en la misma aula.' });
    }
    const horario = await prisma.horarioClase.create({ data: datos, include: incluir });
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

  try {
    const datos = await datosDelBloque(req.body);
    if (datos.error) return res.status(404).json({ error: datos.error });
    if (await chocaConOtraClase(datos, id_hor)) {
      return res.status(409).json({ error: 'Ese horario se cruza con otra clase en la misma aula.' });
    }
    const horario = await prisma.horarioClase.update({ where: { id_hor }, data: datos, include: incluir });
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
