// Utilidades de tiempo compartidas por disponibilidad y reservas.
// Todo se trabaja en "minutos desde medianoche" para comparar franjas sin líos de zona horaria.

const DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

// Acepta "HH:MM" o un Date (columna Time de Prisma, que se lee en UTC).
function aMinutos(valor) {
  if (valor instanceof Date) {
    return valor.getUTCHours() * 60 + valor.getUTCMinutes();
  }
  const [h, m] = String(valor).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Date de hora-del-día en UTC (1970-01-01) a partir de "HH:MM" o de una fecha ISO.
function aHoraUTC(valor) {
  if (typeof valor === 'string' && /^\d{1,2}:\d{2}$/.test(valor)) {
    const [h, m] = valor.split(':').map(Number);
    return new Date(Date.UTC(1970, 0, 1, h, m, 0));
  }
  const d = new Date(valor);
  return new Date(Date.UTC(1970, 0, 1, d.getUTCHours(), d.getUTCMinutes(), 0));
}

// "HH:MM" válido (00:00 - 23:59).
function esHoraValida(valor) {
  return typeof valor === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(valor);
}

function seSolapan(iniA, finA, iniB, finB) {
  return iniA < finB && iniB < finA;
}

// Día de la semana (LUNES..DOMINGO) de una fecha "YYYY-MM-DD".
function diaSemanaDe(fechaStr) {
  const d = new Date(`${fechaStr}T00:00:00.000Z`);
  return DIAS[d.getUTCDay()];
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// "YYYY-MM-DD" o Date -> "16 sep 2026", para mensajes legibles (notificaciones).
function fechaBonita(valor) {
  const s = valor instanceof Date ? valor.toISOString().slice(0, 10) : String(valor).slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  return `${d} ${MESES[m - 1]} ${y}`;
}

// "HH:MM" a partir de un Date (columna Time de Prisma, en UTC) -- misma
// convención "naive" que aMinutos/aHoraUTC.
function horaTxt(valor) {
  const d = new Date(valor);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

// Jornada de la facultad: lunes a viernes, de 07:00 a 20:00, con almuerzo de 13:00 a 14:00
// (sin clases ni reservas). Devuelve el mensaje de error o null si la franja es válida.
// Recibe `fecha` ("YYYY-MM-DD", reservas/solicitudes) o `dia` (LUNES..., horario de clases).
const INICIO_JORNADA = 7 * 60;
const FIN_JORNADA = 20 * 60;
const ALMUERZO_INI = 13 * 60;
const ALMUERZO_FIN = 14 * 60;

function errorDeJornada({ fecha, dia, hora_ini, hora_fin }) {
  const diaSemana = dia || (fecha && diaSemanaDe(fecha));
  if (diaSemana === 'SABADO' || diaSemana === 'DOMINGO') {
    return 'Sábado y domingo no hay actividades en la facultad: elige un día de lunes a viernes.';
  }
  const ini = aMinutos(hora_ini);
  const fin = aMinutos(hora_fin);
  if (ini < INICIO_JORNADA || fin > FIN_JORNADA) {
    return 'La jornada de la facultad es de 07:00 a 20:00.';
  }
  if (seSolapan(ini, fin, ALMUERZO_INI, ALMUERZO_FIN)) {
    return 'De 13:00 a 14:00 es hora de almuerzo: no se programan clases ni reservas.';
  }
  return null;
}

module.exports = {
  DIAS,
  aMinutos,
  aHoraUTC,
  esHoraValida,
  seSolapan,
  diaSemanaDe,
  fechaBonita,
  horaTxt,
  errorDeJornada,
};
