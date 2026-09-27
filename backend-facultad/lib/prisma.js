// Cliente de Prisma ÚNICO para todo el backend.
//
// Antes cada archivo de rutas hacía `new PrismaClient()`: 17 clientes, cada uno con su
// propio grupo de conexiones a Supabase. Con eso se agotaban las conexiones y, sumado a
// cortes momentáneos de la conexión directa (IPv6) con Supabase, algunas peticiones
// fallaban al azar ("Error al obtener las materias") y había que recargar la página.
//
// Además, si una consulta falla por un problema de CONEXIÓN (no de datos), se reintenta
// hasta 2 veces con una pequeña espera:
//  - lecturas: ante cualquier corte de conexión;
//  - escrituras: solo si no se llegó a la base (no se pudo conectar / no había conexión
//    libre), para no arriesgarse a crear algo dos veces.

const { PrismaClient } = require('@prisma/client');

const REINTENTOS = 2;

// No se pudo llegar a la base o no había conexión libre: la operación no se ejecutó.
const SIN_EJECUTAR = new Set(['P1001', 'P1002', 'P2024']);
// Conexión cortada / cerrada a mitad de camino.
const CORTE = new Set(['P1008', 'P1017']);

const LECTURAS = new Set([
  'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany',
  'count', 'aggregate', 'groupBy', '$queryRaw', '$queryRawUnsafe',
]);

function tipoDeFallo(error) {
  const msg = String(error?.message || '');
  if (SIN_EJECUTAR.has(error?.code) || error?.name === 'PrismaClientInitializationError') return 'sin-ejecutar';
  if (/Can't reach database server|Timed out fetching a new connection/i.test(msg)) return 'sin-ejecutar';
  if (CORTE.has(error?.code) || /Server has closed the connection|Connection (reset|terminated|closed)/i.test(msg)) return 'corte';
  return null;
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// La base de Supabase es COMPARTIDA por todo el equipo y tiene un límite de conexiones
// simultáneas. Cada backend abre como máximo CONEXIONES_MAX (salvo que DATABASE_URL ya
// traiga su propio `connection_limit`), para que varios backends encendidos a la vez
// no la llenen ("Too many database connections opened").
const CONEXIONES_MAX = 5;

function urlConLimite(url) {
  if (!url || /[?&]connection_limit=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=${CONEXIONES_MAX}`;
}

const base = new PrismaClient({ datasources: { db: { url: urlConLimite(process.env.DATABASE_URL) } } });

const prisma = base.$extends({
  query: {
    async $allOperations({ model, operation, args, query }) {
      for (let intento = 0; ; intento++) {
        try {
          return await query(args);
        } catch (error) {
          const fallo = tipoDeFallo(error);
          const reintentable = fallo === 'sin-ejecutar' || (fallo === 'corte' && LECTURAS.has(operation));
          if (!reintentable || intento >= REINTENTOS) throw error;
          console.warn(
            `[prisma] ${model ? `${model}.` : ''}${operation}: fallo de conexión, reintento ${intento + 1}/${REINTENTOS}…`
          );
          await esperar(300 * (intento + 1));
        }
      }
    },
  },
});

module.exports = prisma;
