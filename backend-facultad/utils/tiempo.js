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

module.exports = { DIAS, aMinutos, aHoraUTC, esHoraValida, seSolapan, diaSemanaDe, fechaBonita, horaTxt };
