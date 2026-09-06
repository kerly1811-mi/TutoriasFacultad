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

module.exports = { DIAS, aMinutos, aHoraUTC, esHoraValida, seSolapan, diaSemanaDe };
