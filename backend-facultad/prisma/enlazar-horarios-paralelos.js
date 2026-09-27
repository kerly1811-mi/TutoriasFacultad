// Enlaza cada HorarioClase con su Paralelo (columna id_par) a partir del texto
// "MATERIA - 4A SW" de nombre_curso + el docente del bloque:
//   materia (sin importar tildes/mayúsculas) + número de nivel + letra del paralelo
//   + sigla de la carrera + mismo docente  ->  id_par.
// Solo toca horarios con id_par vacío; es idempotente (se puede correr varias veces).
// Lo usan los seeds de horarios al terminar, y también se puede correr solo:
//
//   node prisma/enlazar-horarios-paralelos.js
//
// Usa SQL directo para funcionar aunque el cliente de Prisma no se haya regenerado.

const { PrismaClient } = require('@prisma/client');

const SIGLA_CARRERA = {
  SW: 'software',
  TI: 'tecnologias de la informacion',
  IT: 'telecomunicaciones',
  II: 'industrial',
  RA: 'robotica',
};
const NUMERO_NIVEL = {
  'primer semestre': 1, 'segundo semestre': 2, 'tercer semestre': 3, 'cuarto semestre': 4,
  'quinto semestre': 5, 'sexto semestre': 6, 'septimo semestre': 7, 'octavo semestre': 8,
  'noveno semestre': 9, 'decimo semestre': 10,
};

const normalizar = (t = '') =>
  String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

async function enlazarHorariosConParalelos(prisma) {
  const paralelos = await prisma.paralelo.findMany({
    include: { materia: true, nivel: { include: { carrera: true } } },
  });
  const porClave = new Map(
    paralelos.map((p) => [
      [normalizar(p.materia.nom_mat), NUMERO_NIVEL[normalizar(p.nivel.nom_niv)], normalizar(p.nom_par),
        normalizar(p.nivel.carrera.nom_car), p.id_doc].join('|'),
      p.id_par,
    ])
  );

  const horarios = await prisma.$queryRaw`
    SELECT id_hor, nombre_curso, id_doc FROM "HorarioClase" WHERE id_par IS NULL`;

  const idsPorParalelo = new Map();
  const sinEnlazar = [];
  for (const h of horarios) {
    const m = String(h.nombre_curso).match(/^(.*) - (\d+)([A-Za-z]) ([A-Za-z]+)$/);
    const id_par =
      m &&
      porClave.get(
        [normalizar(m[1]), Number(m[2]), normalizar(m[3]), SIGLA_CARRERA[m[4].toUpperCase()], h.id_doc].join('|')
      );
    if (!id_par) {
      sinEnlazar.push(h.nombre_curso);
      continue;
    }
    if (!idsPorParalelo.has(id_par)) idsPorParalelo.set(id_par, []);
    idsPorParalelo.get(id_par).push(h.id_hor);
  }

  let enlazados = 0;
  for (const [id_par, ids] of idsPorParalelo) {
    enlazados += await prisma.$executeRawUnsafe(
      `UPDATE "HorarioClase" SET id_par = $1 WHERE id_hor = ANY($2::int[])`,
      id_par,
      ids
    );
  }

  console.log(`Horarios enlazados con su paralelo: ${enlazados}. Sin paralelo: ${sinEnlazar.length}.`);
  if (sinEnlazar.length) console.log('  Sin enlazar:', [...new Set(sinEnlazar)].slice(0, 20));
  return { enlazados, sinEnlazar };
}

if (require.main === module) {
  const prisma = new PrismaClient();
  enlazarHorariosConParalelos(prisma)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { enlazarHorariosConParalelos };
