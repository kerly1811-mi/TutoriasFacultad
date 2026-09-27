// Nombre legible de un curso a partir de su paralelo: "BASE DE DATOS - 4A SW"
// (mismo formato que el horario oficial de la FISEI).

const SIGLA_POR_CARRERA = {
  software: 'SW',
  'tecnologias de la informacion': 'TI',
  telecomunicaciones: 'IT',
  industrial: 'II',
  robotica: 'RA',
};

const NUMERO_NIVEL = {
  'primer semestre': 1, 'segundo semestre': 2, 'tercer semestre': 3, 'cuarto semestre': 4,
  'quinto semestre': 5, 'sexto semestre': 6, 'septimo semestre': 7, 'octavo semestre': 8,
  'noveno semestre': 9, 'decimo semestre': 10,
};

const normalizar = (t = '') =>
  String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Carreras sin sigla conocida: iniciales de sus palabras ("Ingeniería Civil" -> "IC").
function siglaCarrera(nomCarrera) {
  const n = normalizar(nomCarrera);
  if (SIGLA_POR_CARRERA[n]) return SIGLA_POR_CARRERA[n];
  return n
    .split(' ')
    .filter((p) => p.length > 2)
    .map((p) => p[0].toUpperCase())
    .join('')
    .slice(0, 3);
}

// Número del nivel ("Cuarto Semestre" -> 4); si no se reconoce, el primer número del texto.
function numeroNivel(nomNivel) {
  return NUMERO_NIVEL[normalizar(nomNivel)] ?? Number(String(nomNivel).match(/\d+/)?.[0] ?? 0);
}

// paralelo debe incluir materia.nom_mat, nivel.nom_niv y nivel.carrera.nom_car.
function nombreCursoDe(paralelo) {
  const { materia, nivel, nom_par } = paralelo;
  return `${materia.nom_mat} - ${numeroNivel(nivel.nom_niv)}${nom_par} ${siglaCarrera(nivel.carrera.nom_car)}`;
}

module.exports = { nombreCursoDe, siglaCarrera, numeroNivel };
