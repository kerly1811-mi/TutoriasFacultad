const express = require('express');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');
const { aMinutos, seSolapan } = require('../utils/tiempo');

const router = express.Router();
const prisma = require('../lib/prisma');

// Un estudiante puede estar matriculado como máximo en 5 materias a la vez.
const MAX_MATERIAS_POR_ESTUDIANTE = 5;

const ETIQUETA_DIA = {
  LUNES: 'lunes', MARTES: 'martes', MIERCOLES: 'miércoles', JUEVES: 'jueves', VIERNES: 'viernes', SABADO: 'sábado',
};

/**
 * Reglas de matrícula (las usan tanto el admin como la automatrícula del estudiante).
 * Un estudiante puede mezclar materias de distintos niveles; lo que se controla es:
 *  - máximo MAX_MATERIAS_POR_ESTUDIANTE materias;
 *  - no repetir la misma materia (p. ej. Redes en 4A y en 4B);
 *  - que el horario del paralelo nuevo no se cruce con el de sus otras materias.
 * Devuelve { error, status } o { paralelo } si se puede matricular.
 */
async function validarMatricula(id_est, id_par) {
  const paralelo = await prisma.paralelo.findUnique({
    where: { id_par },
    include: { materia: true, horarios: true },
  });
  if (!paralelo) return { status: 404, error: 'Paralelo no encontrado.' };

  const actuales = await prisma.matricula.findMany({
    where: { id_est },
    include: { paralelo: { include: { materia: true, horarios: true } } },
  });

  if (actuales.some((m) => m.id_par === id_par)) {
    return { status: 409, error: 'El estudiante ya está matriculado en este paralelo.' };
  }
  if (actuales.length >= MAX_MATERIAS_POR_ESTUDIANTE) {
    return {
      status: 400,
      error: `Ya tiene ${MAX_MATERIAS_POR_ESTUDIANTE} materias matriculadas (máximo permitido).`,
    };
  }
  const mismaMateria = actuales.find((m) => m.paralelo.id_mat === paralelo.id_mat);
  if (mismaMateria) {
    return {
      status: 400,
      error: `Ya está matriculado en ${paralelo.materia.nom_mat} (paralelo ${mismaMateria.paralelo.nom_par}).`,
    };
  }
  for (const m of actuales) {
    for (const a of m.paralelo.horarios) {
      const choque = paralelo.horarios.find(
        (b) =>
          a.dia_semana === b.dia_semana &&
          seSolapan(aMinutos(a.hora_ini), aMinutos(a.hora_fin), aMinutos(b.hora_ini), aMinutos(b.hora_fin))
      );
      if (choque) {
        return {
          status: 400,
          error: `El horario se cruza con ${m.paralelo.materia.nom_mat} el ${ETIQUETA_DIA[a.dia_semana] || a.dia_semana} a las ${a.hora_ini}.`,
        };
      }
    }
  }
  return { paralelo };
}

async function crearMatricula(id_est, id_par) {
  return prisma.matricula.create({
    data: { id_est, id_par },
    include: {
      estudiante: { select: { nombres: true, apellidos: true } },
      paralelo: { include: incluirParalelo },
    },
  });
}

const incluirParalelo = {
  materia: { select: { nom_mat: true } },
  nivel: { select: { nom_niv: true, carrera: { select: { nom_car: true } } } },
  docente: { select: { id_usr: true, nombres: true, apellidos: true } },
};

// ==========================================
// MATRICULAR ESTUDIANTE EN UN PARALELO (SOLO ADMINISTRADORES)
// ==========================================
router.post('/', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const { id_est, id_par } = req.body;

  if (!id_est || !id_par) {
    return res.status(400).json({ error: 'Faltan datos (estudiante y paralelo).' });
  }

  try {
    const estudiante = await prisma.usuario.findUnique({ where: { id_usr: Number(id_est) } });
    if (!estudiante || estudiante.rol !== 'ESTUDIANTE') {
      return res.status(400).json({ error: 'El usuario indicado no existe o no tiene rol ESTUDIANTE.' });
    }

    const validacion = await validarMatricula(Number(id_est), Number(id_par));
    if (validacion.error) return res.status(validacion.status).json({ error: validacion.error });

    const nueva = await crearMatricula(Number(id_est), Number(id_par));
    res.status(201).json({ mensaje: 'Estudiante matriculado exitosamente', matricula: nueva });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'El estudiante ya está matriculado en este paralelo.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al matricular al estudiante.' });
  }
});

// ==========================================
// AUTOMATRÍCULA: EL ESTUDIANTE SE INSCRIBE / SE RETIRA DE UN PARALELO
// Mismas reglas que la matrícula del admin (validarMatricula).
// ==========================================
router.post('/mias', verificarToken, verificarRol(['ESTUDIANTE']), async (req, res) => {
  const id_par = Number(req.body.id_par);
  if (!id_par) return res.status(400).json({ error: 'Indica el paralelo (id_par).' });

  try {
    const validacion = await validarMatricula(req.usuario.id, id_par);
    if (validacion.error) return res.status(validacion.status).json({ error: validacion.error });

    const nueva = await crearMatricula(req.usuario.id, id_par);
    res.status(201).json({ mensaje: 'Te inscribiste en el paralelo.', matricula: nueva });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya estás inscrito en este paralelo.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al inscribirte en el paralelo.' });
  }
});

router.delete('/mias/:id', verificarToken, verificarRol(['ESTUDIANTE']), async (req, res) => {
  const id_matricula = Number(req.params.id);
  try {
    const matricula = await prisma.matricula.findUnique({ where: { id_matricula } });
    if (!matricula || matricula.id_est !== req.usuario.id) {
      return res.status(404).json({ error: 'Matrícula no encontrada.' });
    }
    await prisma.matricula.delete({ where: { id_matricula } });
    res.json({ mensaje: 'Te retiraste del paralelo.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al retirarte del paralelo.' });
  }
});

// ==========================================
// LISTAR MATRÍCULAS   ?id_par=  ?id_est=
// ADMINISTRADOR ve cualquier combinación. ESTUDIANTE solo puede ver las suyas
// (se ignora cualquier `id_est` que mande; siempre se fuerza al suyo propio).
// DOCENTE debe indicar `id_par` de un paralelo suyo (para ver la lista del curso,
// p. ej. al pasar asistencia manual).
// ==========================================
router.get('/', verificarToken, async (req, res) => {
  const rol = req.usuario.rol;
  if (!['ADMINISTRADOR', 'ESTUDIANTE', 'DOCENTE'].includes(rol)) {
    return res.status(403).json({ error: 'No tienes permiso para ver las matrículas.' });
  }

  const { id_par } = req.query;
  const id_est = rol === 'ADMINISTRADOR' ? req.query.id_est : rol === 'ESTUDIANTE' ? req.usuario.id : undefined;

  if (rol === 'DOCENTE') {
    if (!id_par) return res.status(400).json({ error: 'Indica el paralelo (id_par).' });
    const paralelo = await prisma.paralelo.findUnique({ where: { id_par: Number(id_par) } });
    if (!paralelo || paralelo.id_doc !== req.usuario.id) {
      return res.status(403).json({ error: 'Ese curso no te pertenece.' });
    }
  }

  try {
    const matriculas = await prisma.matricula.findMany({
      where: {
        ...(id_par && { id_par: Number(id_par) }),
        ...(id_est && { id_est: Number(id_est) }),
      },
      include: {
        estudiante: { select: { id_usr: true, nombres: true, apellidos: true, cedula: true } },
        paralelo: { include: incluirParalelo },
      },
      orderBy: { id_matricula: 'desc' },
    });
    res.json(matriculas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener las matrículas.' });
  }
});

// ==========================================
// ELIMINAR MATRÍCULA (SOLO ADMINISTRADORES)
// ==========================================
router.delete('/:id', verificarToken, verificarRol(['ADMINISTRADOR']), async (req, res) => {
  const id_matricula = Number(req.params.id);

  try {
    await prisma.matricula.delete({ where: { id_matricula } });
    res.json({ mensaje: 'Matrícula eliminada' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Matrícula no encontrada.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar la matrícula.' });
  }
});

module.exports = router;
