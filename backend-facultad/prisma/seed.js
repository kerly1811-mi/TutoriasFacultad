const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Aulas y laboratorios del edificio de la FISEI.
// >>> REEMPLAZA esta lista por la real y vuelve a correr `npx prisma db seed`. <<<
// El seed solo AÑADE los que falten (compara por nombre), no duplica ni borra.
const ESPACIOS = [
  { nom_esp: 'Aula 301', tipo: 'AULA', capacidad: 40, bloque: 'BLOQUE_1', piso: '3' },
  { nom_esp: 'Aula 302', tipo: 'AULA', capacidad: 40, bloque: 'BLOQUE_1', piso: '3' },
  { nom_esp: 'Aula 303', tipo: 'AULA', capacidad: 40, bloque: 'BLOQUE_1', piso: '3' },
  { nom_esp: 'Aula 304', tipo: 'AULA', capacidad: 35, bloque: 'BLOQUE_1', piso: '3' },
  { nom_esp: 'Aula 305', tipo: 'AULA', capacidad: 35, bloque: 'BLOQUE_1', piso: '3' },
  { nom_esp: 'Aula Magna', tipo: 'AULA', capacidad: 120, bloque: 'BLOQUE_1', piso: '1' },
  { nom_esp: 'Laboratorio de Redes', tipo: 'LABORATORIO', capacidad: 30, bloque: 'BLOQUE_2', piso: 'C' },
  { nom_esp: 'Laboratorio de Software', tipo: 'LABORATORIO', capacidad: 30, bloque: 'BLOQUE_2', piso: 'C' },
  { nom_esp: 'Laboratorio de Hardware', tipo: 'LABORATORIO', capacidad: 25, bloque: 'BLOQUE_2', piso: 'D' },
  { nom_esp: 'Laboratorio de Electrónica', tipo: 'LABORATORIO', capacidad: 25, bloque: 'BLOQUE_2', piso: 'D' },
];

async function main() {
  const existentes = await prisma.espacio.findMany({ select: { nom_esp: true } });
  const nombres = new Set(existentes.map((e) => e.nom_esp.trim().toLowerCase()));

  const faltantes = ESPACIOS.filter((e) => !nombres.has(e.nom_esp.trim().toLowerCase()));

  if (faltantes.length === 0) {
    console.log('Nada que insertar: todos los espacios de la lista ya existen.');
    return;
  }

  const { count } = await prisma.espacio.createMany({ data: faltantes });
  console.log(`Insertados ${count} espacios nuevos:`);
  faltantes.forEach((e) => console.log(`  - ${e.nom_esp}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
