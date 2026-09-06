// Borra TODAS las reservas de prueba (y su asistencia/documentos).
// Se crearon con el flujo viejo y tienen la hora desfasada. Córrelo una vez:
//   node prisma/limpiar-reservas.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.asistencia.deleteMany({});
  await prisma.documento.deleteMany({});
  const { count } = await prisma.reserva.deleteMany({});
  console.log(`Reservas de prueba eliminadas: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
