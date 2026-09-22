// ============================================================================
// ⚠️  SCRIPT DESTRUCTIVO-SEGURO DE CARGA (no borra nada, solo inserta) ⚠️
// Carga el horario de TODAS LAS CARRERAS de la FISEI (periodo JULIO - DICIEMBRE 2026),
// extraído automáticamente de Horarios-Fisei.pdf con coordenadas de texto
// (PyMuPDF) agrupando por posición de columna (día) y fila (hora) y por
// tamaño de fuente (los nombres de docente se imprimen en fuente más chica
// que la materia/código en el PDF original, lo que permitió separarlos de
// forma confiable).
//
// Ejecutar desde la carpeta backend-facultad:
//   node prisma/seed-horarios-completo.js
//
// Es idempotente (usa upserts / búsquedas por nombre antes de crear), así que
// se puede correr varias veces sin duplicar filas.
//
// ---------------------------------------------------------------------------
// SUPUESTOS Y AMBIGÜEDADES A REVISAR (ver también el reporte final del chat):
// ---------------------------------------------------------------------------
// 1. Carreras "TI" e "IT": el usuario confirmó que son DOS carreras
//    distintas, no una sola: el código "IT" impreso en el PDF corresponde a
//    Telecomunicaciones y el código "TI" corresponde a Tecnologías de la
//    Información. Se separaron cada Nivel/Paralelo según el código
//    literalmente impreso en esa celda del PDF (preservado en el sufijo de
//    "nombre_curso", ej. "... - 3A TI" vs "... - 3A IT"), NO por el nombre de
//    la materia. Se añadió la carrera "Telecomunicaciones" a DATA.carreras y
//    a DATA.niveles (mismos números de semestre que ya existían para
//    Tecnologías de la Información).
//    Casos revisados y corregidos manualmente contra el PDF original
//    (verificación página por página, ver reporte del chat):
//    - "DESARROLLO DE PROYECTOS" 9°A: en el PDF son DOS paralelos reales y
//      distintos: "9A TI" con Urvina Barrionuevo Klever Renato (Tecnologías
//      de la Información) y "9A IT" con Altamirano Meléndez Santiago
//      Mauricio (Telecomunicaciones). El segundo se dicta en la hoja
//      "AULA 9 (40) - CIENCIAS APLICADAS", que pertenece a otro bloque/
//      edificio fuera de alcance de este script (no EDIFICIO 1/2) y no se
//      procesa aquí por decisión explícita. Por lo tanto SOLO se registra
//      el paralelo "9A TI" (Urvina); el paralelo de Altamirano/
//      Telecomunicaciones para esta materia queda fuera intencionalmente.
//    - "CONMUTACIÓN Y ENRUTAMIENTO BÁSICO" 5°A (Urrutia Urrutia Elsa Pilar):
//      el paralelo completo es de Tecnologías de la Información (TI); las 2
//      franjas que habían quedado etiquetadas "5A IT" (MARTES 9:00-10:00 y
//      12:00-13:00, LAB. REDES 1) eran error y se corrigieron a "5A TI".
//    - "INTERACCIÓN HUMANO / COMPUTADOR" (Caiza Caizabuano Jose Ruben): NO
//      es una materia de TI ni de IT. Verificado contra LABORATORIO 8 (40) -
//      EDIFICIO 1 (página 8 del PDF): todas las franjas de este docente para
//      esta materia están impresas como "5A SW" (Software, Quinto Semestre),
//      tanto en Miércoles 10:00-12:00 como en Martes (donde el extractor
//      había tomado por error el código "3A TI"/"3A IT" de una celda vecina
//      de la misma hoja). Se eliminó el Paralelo erróneo de nivel 3° /
//      Tecnologías de la Información (ya existía el Paralelo correcto de
//      nivel 5° / Software) y se corrigieron los 3 HorarioClase afectados a
//      "5A SW".
// 2. Pisos de laboratorios del Bloque 1 (Edificio 1): se usó la distribución
//    dada por el usuario (Lab 1-2-8 piso 2; Lab 3-4-5-6-7 piso 3). Los
//    laboratorios que NO están en esa lista (LAB. CTT, LAB. REDES 1/2,
//    LAB. ELECTRÓNICA AVANZADA/BÁSICA) quedaron con piso = null (desconocido).
// 3. Piso de aulas del Bloque 2 (Edificio 2): se tomó la letra del nombre del
//    aula (ej. "AULA H05" -> piso "H"). Los laboratorios de Edificio 2 sin
//    letra en el nombre (LAB. INDUSTRIAL 1/2, LAB. ROBÓTICA Y REDES
//    INDUSTRIALES, LAB. AUTOMATIZACIÓN INDUSTRIAL, LAB. COMUNICACIONES,
//    LAB. INSTRUMENTACIÓN VIRTUAL, LAB. MÁQUINAS ELÉCTRICAS, LAB. PLC'S,
//    LAB. REDES Y FIBRA ÓPTICA) quedaron con piso = null.
// 4. Capacidad: se usó el número entre paréntesis del título de cada hoja del
//    PDF tal cual (ej. "LABORATORIO 3 (24)" -> capacidad 24).
// 5. Cada franja horaria del PDF (1 hora) se cargó como un HorarioClase
//    independiente, sin intentar fusionar horas consecutivas de la misma
//    materia/docente en un único bloque de 2+ horas (instrucción explícita
//    del usuario: es más seguro que asumir agrupaciones).
// 6. Casillas del PDF con código (nivel+paralelo+carrera) pero SIN docente
//    para esa sesión sí se cargaron como HorarioClase (id_doc queda NULL,
//    el schema lo permite), pero NO generan un Paralelo (Paralelo.id_doc es
//    obligatorio en el schema), así que esas sesiones no quedan asociadas a
//    ningún Paralelo/Matricula.
// 7. Casillas totalmente incompletas (sin código nivel+paralelo+carrera, o
//    con datos truncados/ambiguos) se omitieron por completo, tal como pidió
//    el usuario (regla "si falta nivel/paralelo/carrera o docente Y materia,
//    no registrar").
// 8. Se ignoraron por completo las hojas "LAB. CNC - TALLERES TECNOLÓGICOS",
//    "ÁREA PRÁCTICA TALLERES" y las 4 hojas "AULA 7/8/9/10 - CIENCIAS
//    APLICADAS" (no terminan en "EDIFICIO 1"/"EDIFICIO 2", regla explícita
//    del usuario).
// 9. División nombres/apellidos de cada docente: el PDF solo da el nombre
//    completo en mayúsculas (convención ecuatoriana "Apellido1 Apellido2
//    Nombre1 Nombre2"), así que se partió la cadena de palabras a la mitad
//    como aproximación. Puede quedar mal dividido en nombres compuestos
//    irregulares o con un solo apellido/nombre — revisar la tabla Usuario
//    después de importar.
// 10. Correos de docentes: inventados con el patrón
//     primera-palabra.última-palabra@uta.edu.ec (normalizado sin tildes), con
//     sufijo numérico si hay colisión. No son correos reales.
// 11. Cédulas de docentes: sintéticas, deterministas, con prefijo de
//     provincia "18" (Tungurahua/Ambato) y dígito verificador calculado con
//     el mismo algoritmo de utils/validadores.js — pasan la validación pero
//     NO son cédulas reales de nadie.
// 12. EXCLUIDO POR COMPLETO: "DESARROLLO DE GUÍAS APE" (y sus variantes con
//     el texto repetido/concatenado, ej. "DESARROLLO DE GUÍAS APE
//     DESARROLLO DE GUÍAS APE ..."). Eran sesiones consecutivas SIN docente
//     impreso en el PDF (el extractor no pudo saber dónde terminaba una hora
//     y empezaba la siguiente), a petición del usuario se eliminaron
//     totalmente de DATA.materias, DATA.paralelos y DATA.horarios — no debe
//     quedar ningún rastro de esta "materia" en el script.
// 13. Duplicados por acentuación inconsistente en el propio PDF (ej.
//     "ADMINISTRACION DE LA PRODUCCIÓN" sin tilde en una hoja y
//     "ADMINISTRACIÓN DE LA PRODUCCIÓN" con tilde en otra; "CIRCUITOS
//     ELECTRONICOS" / "CIRCUITOS ELECTRÓNICOS") fueron revisados y
//     fusionados manualmente: se conservó siempre la grafía CON tildes
//     correctas y se eliminó/reapuntó la variante sin tildes de
//     DATA.materias, DATA.paralelos y del sufijo de "nombre_curso" en
//     DATA.horarios, para las 6 materias: "ADMINISTRACIÓN DE LA
//     PRODUCCIÓN", "CIRCUITOS ELECTRÓNICOS", "COMUNICACIONES MÓVILES",
//     "ESTADÍSTICA Y PROBABILIDAD", "FÍSICA PARA ELECTRÓNICA" e
//     "INGENIERÍA DE MÉTODOS". No debe quedar ninguna variante sin tildes
//     de estas 6 materias en el script.
// ============================================================================

const { runSeedHorarios } = require('./_horarios-runner');

const DATA = {
  "espacios": [
    {
      "nom_esp": "LABORATORIO 1",
      "tipo": "LABORATORIO",
      "capacidad": 40,
      "bloque": "BLOQUE_1",
      "piso": "2",
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "LABORATORIO 2",
      "tipo": "LABORATORIO",
      "capacidad": 40,
      "bloque": "BLOQUE_1",
      "piso": "2",
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "LABORATORIO 3",
      "tipo": "LABORATORIO",
      "capacidad": 24,
      "bloque": "BLOQUE_1",
      "piso": "3",
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "LABORATORIO 4",
      "tipo": "LABORATORIO",
      "capacidad": 24,
      "bloque": "BLOQUE_1",
      "piso": "3",
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "LABORATORIO 5",
      "tipo": "LABORATORIO",
      "capacidad": 24,
      "bloque": "BLOQUE_1",
      "piso": "3",
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "LABORATORIO 6",
      "tipo": "LABORATORIO",
      "capacidad": 32,
      "bloque": "BLOQUE_1",
      "piso": "3",
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "LABORATORIO 7",
      "tipo": "LABORATORIO",
      "capacidad": 40,
      "bloque": "BLOQUE_1",
      "piso": "3",
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "LABORATORIO 8",
      "tipo": "LABORATORIO",
      "capacidad": 40,
      "bloque": "BLOQUE_1",
      "piso": "2",
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "LAB. CTT",
      "tipo": "LABORATORIO",
      "capacidad": 52,
      "bloque": "BLOQUE_1",
      "piso": null,
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "LAB. REDES 1",
      "tipo": "LABORATORIO",
      "capacidad": 38,
      "bloque": "BLOQUE_1",
      "piso": null,
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "LAB. REDES 2",
      "tipo": "LABORATORIO",
      "capacidad": 40,
      "bloque": "BLOQUE_1",
      "piso": null,
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "LAB. INDUSTRIAL 1",
      "tipo": "LABORATORIO",
      "capacidad": 32,
      "bloque": "BLOQUE_2",
      "piso": null,
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "LAB. INDUSTRIAL 2",
      "tipo": "LABORATORIO",
      "capacidad": 32,
      "bloque": "BLOQUE_2",
      "piso": null,
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "tipo": "LABORATORIO",
      "capacidad": 40,
      "bloque": "BLOQUE_2",
      "piso": null,
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "LAB. AUTOMATIZACIÓN INDUSTRIAL",
      "tipo": "LABORATORIO",
      "capacidad": 32,
      "bloque": "BLOQUE_2",
      "piso": null,
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "LAB. COMUNICACIONES",
      "tipo": "LABORATORIO",
      "capacidad": 25,
      "bloque": "BLOQUE_2",
      "piso": null,
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "LAB. ELECTRÓNICA AVANZADA",
      "tipo": "LABORATORIO",
      "capacidad": 32,
      "bloque": "BLOQUE_1",
      "piso": null,
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "LAB. ELECTRÓNICA BÁSICA",
      "tipo": "LABORATORIO",
      "capacidad": 25,
      "bloque": "BLOQUE_1",
      "piso": null,
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "LAB. INSTRUMENTACIÓN VIRTUAL",
      "tipo": "LABORATORIO",
      "capacidad": 24,
      "bloque": "BLOQUE_2",
      "piso": null,
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "LAB. MÁQUINAS ELÉCTRICAS",
      "tipo": "LABORATORIO",
      "capacidad": 25,
      "bloque": "BLOQUE_2",
      "piso": null,
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "LAB. PLC'S",
      "tipo": "LABORATORIO",
      "capacidad": 25,
      "bloque": "BLOQUE_2",
      "piso": null,
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "LAB. REDES Y FIBRA ÓPTICA",
      "tipo": "LABORATORIO",
      "capacidad": 20,
      "bloque": "BLOQUE_2",
      "piso": null,
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "AULA C01",
      "tipo": "AULA",
      "capacidad": 32,
      "bloque": "BLOQUE_1",
      "piso": null,
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "AULA F01",
      "tipo": "AULA",
      "capacidad": 30,
      "bloque": "BLOQUE_2",
      "piso": "F",
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "AULA F02",
      "tipo": "AULA",
      "capacidad": 40,
      "bloque": "BLOQUE_2",
      "piso": "F",
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "AULA F03",
      "tipo": "AULA",
      "capacidad": 40,
      "bloque": "BLOQUE_2",
      "piso": "F",
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "AULA F04",
      "tipo": "AULA",
      "capacidad": 40,
      "bloque": "BLOQUE_2",
      "piso": "F",
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "AULA F08",
      "tipo": "AULA",
      "capacidad": 40,
      "bloque": "BLOQUE_2",
      "piso": "F",
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "AULA G02",
      "tipo": "AULA",
      "capacidad": 32,
      "bloque": "BLOQUE_2",
      "piso": "G",
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "AULA G03",
      "tipo": "AULA",
      "capacidad": 30,
      "bloque": "BLOQUE_2",
      "piso": "G",
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "AULA G04",
      "tipo": "AULA",
      "capacidad": 46,
      "bloque": "BLOQUE_2",
      "piso": "G",
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "AULA H02",
      "tipo": "AULA",
      "capacidad": 30,
      "bloque": "BLOQUE_2",
      "piso": "H",
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "AULA H03",
      "tipo": "AULA",
      "capacidad": 40,
      "bloque": "BLOQUE_2",
      "piso": "H",
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "AULA H04",
      "tipo": "AULA",
      "capacidad": 40,
      "bloque": "BLOQUE_2",
      "piso": "H",
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "AULA H05",
      "tipo": "AULA",
      "capacidad": 30,
      "bloque": "BLOQUE_2",
      "piso": "H",
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "AULA I01",
      "tipo": "AULA",
      "capacidad": 48,
      "bloque": "BLOQUE_2",
      "piso": "I",
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "AULA I02",
      "tipo": "AULA",
      "capacidad": 40,
      "bloque": "BLOQUE_2",
      "piso": "I",
      "estado": "DISPONIBLE",
      "activo": true
    },
    {
      "nom_esp": "AULA I03",
      "tipo": "AULA",
      "capacidad": 48,
      "bloque": "BLOQUE_2",
      "piso": "I",
      "estado": "DISPONIBLE",
      "activo": true
    }
  ],
  "carreras": [
    "Industrial",
    "Robótica",
    "Software",
    "Tecnologías de la Información",
    "Telecomunicaciones"
  ],
  "niveles": [
    {
      "nom_niv": "Tercer Semestre",
      "carrera": "Software",
      "numero": 3
    },
    {
      "nom_niv": "Sexto Semestre",
      "carrera": "Software",
      "numero": 6
    },
    {
      "nom_niv": "Segundo Semestre",
      "carrera": "Software",
      "numero": 2
    },
    {
      "nom_niv": "Cuarto Semestre",
      "carrera": "Software",
      "numero": 4
    },
    {
      "nom_niv": "Tercer Semestre",
      "carrera": "Tecnologías de la Información",
      "numero": 3
    },
    {
      "nom_niv": "Octavo Semestre",
      "carrera": "Software",
      "numero": 8
    },
    {
      "nom_niv": "Segundo Semestre",
      "carrera": "Industrial",
      "numero": 2
    },
    {
      "nom_niv": "Primer Semestre",
      "carrera": "Software",
      "numero": 1
    },
    {
      "nom_niv": "Quinto Semestre",
      "carrera": "Software",
      "numero": 5
    },
    {
      "nom_niv": "Segundo Semestre",
      "carrera": "Tecnologías de la Información",
      "numero": 2
    },
    {
      "nom_niv": "Primer Semestre",
      "carrera": "Robótica",
      "numero": 1
    },
    {
      "nom_niv": "Segundo Semestre",
      "carrera": "Robótica",
      "numero": 2
    },
    {
      "nom_niv": "Séptimo Semestre",
      "carrera": "Tecnologías de la Información",
      "numero": 7
    },
    {
      "nom_niv": "Séptimo Semestre",
      "carrera": "Software",
      "numero": 7
    },
    {
      "nom_niv": "Cuarto Semestre",
      "carrera": "Tecnologías de la Información",
      "numero": 4
    },
    {
      "nom_niv": "Quinto Semestre",
      "carrera": "Tecnologías de la Información",
      "numero": 5
    },
    {
      "nom_niv": "Sexto Semestre",
      "carrera": "Tecnologías de la Información",
      "numero": 6
    },
    {
      "nom_niv": "Primer Semestre",
      "carrera": "Tecnologías de la Información",
      "numero": 1
    },
    {
      "nom_niv": "Octavo Semestre",
      "carrera": "Tecnologías de la Información",
      "numero": 8
    },
    {
      "nom_niv": "Noveno Semestre",
      "carrera": "Tecnologías de la Información",
      "numero": 9
    },
    {
      "nom_niv": "Sexto Semestre",
      "carrera": "Robótica",
      "numero": 6
    },
    {
      "nom_niv": "Séptimo Semestre",
      "carrera": "Industrial",
      "numero": 7
    },
    {
      "nom_niv": "Octavo Semestre",
      "carrera": "Industrial",
      "numero": 8
    },
    {
      "nom_niv": "Cuarto Semestre",
      "carrera": "Industrial",
      "numero": 4
    },
    {
      "nom_niv": "Primer Semestre",
      "carrera": "Industrial",
      "numero": 1
    },
    {
      "nom_niv": "Quinto Semestre",
      "carrera": "Industrial",
      "numero": 5
    },
    {
      "nom_niv": "Sexto Semestre",
      "carrera": "Industrial",
      "numero": 6
    },
    {
      "nom_niv": "Tercer Semestre",
      "carrera": "Robótica",
      "numero": 3
    },
    {
      "nom_niv": "Tercer Semestre",
      "carrera": "Industrial",
      "numero": 3
    },
    {
      "nom_niv": "Quinto Semestre",
      "carrera": "Robótica",
      "numero": 5
    },
    {
      "nom_niv": "Cuarto Semestre",
      "carrera": "Robótica",
      "numero": 4
    },
    {
      "nom_niv": "Noveno Semestre",
      "carrera": "Industrial",
      "numero": 9
    },
    {
      "nom_niv": "Tercer Semestre",
      "carrera": "Telecomunicaciones",
      "numero": 3
    },
    {
      "nom_niv": "Segundo Semestre",
      "carrera": "Telecomunicaciones",
      "numero": 2
    },
    {
      "nom_niv": "Cuarto Semestre",
      "carrera": "Telecomunicaciones",
      "numero": 4
    },
    {
      "nom_niv": "Quinto Semestre",
      "carrera": "Telecomunicaciones",
      "numero": 5
    },
    {
      "nom_niv": "Séptimo Semestre",
      "carrera": "Telecomunicaciones",
      "numero": 7
    },
    {
      "nom_niv": "Primer Semestre",
      "carrera": "Telecomunicaciones",
      "numero": 1
    },
    {
      "nom_niv": "Octavo Semestre",
      "carrera": "Telecomunicaciones",
      "numero": 8
    },
    {
      "nom_niv": "Sexto Semestre",
      "carrera": "Telecomunicaciones",
      "numero": 6
    }
  ],
  "materias": [
    "ADMINISTRACIÓN DE BASE DE DATOS",
    "ADMINISTRACIÓN DE LA PRODUCCIÓN",
    "ADMINISTRACIÓN DE REDES",
    "ADMINISTRACIÓN DE SISTEMAS OPERATIVOS",
    "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN",
    "ANÁLISIS DE CIRCUITOS",
    "APLICACIONES DISTRIBUIDAS",
    "APLICACIONES MÓVILES",
    "APLICACIONES ORIENTADAS A SERVICIOS",
    "APLICACIONES WEB Y MÓVILES",
    "ARQUITECTURA Y PLATAFORMAS DE SERVIDORES",
    "AUDITORÍA DE SISTEMAS DE INFORMACIÓN",
    "AUDITORÍA DE TI",
    "AUTOMATIZACIÓN INDUSTRIAL Y ROBÓTICA",
    "BASE DE DATOS",
    "CIRCUITOS ELECTRÓNICOS",
    "CIRCUITOS ELÉCTRICOS",
    "CIRCUITOS RF",
    "COMPUTACIÓN VISUAL",
    "COMUNICACIONES AVANZADAS",
    "COMUNICACIONES MÓVILES",
    "COMUNICACIONES ÓPTICAS",
    "COMUNICACIÓN ANALÓGICA",
    "COMUNICACIÓN DIGITAL",
    "CONMUTACIÓN Y ENRUTAMIENTO AVANZADO",
    "CONMUTACIÓN Y ENRUTAMIENTO BÁSICO",
    "CONMUTACIÓN Y ENRUTAMIENTO DE REDES",
    "CONTABILIDAD Y COSTOS INDUSTRIALES",
    "CONTROL DE CALIDAD",
    "CONTROL NEUMÁTICO E HIDRAÚLICO",
    "CONTROL NEUMÁTICO Y OLEOHIDRÁULICA",
    "CÁLCULO DE UNA VARIABLE",
    "CÁLCULO DE VARIAS VARIABLES",
    "CÁLCULO DIFERENCIAL",
    "CÁLCULO I",
    "CÁLCULO II",
    "CÁLCULO INTEGRAL",
    "DESARROLLO ASISTIDO POR SOFTWARE",
    "DESARROLLO DE PROYECTOS",
    "DIBUJO ASISTIDO POR COMPUTADOR",
    "DISEÑO DE PROYECTOS",
    "DISEÑO Y ORGANIZACIÓN DE PLANTAS",
    "DISPOSITIVOS Y MEDIDAS",
    "ECUACIONES DIFERENCIALES",
    "ELECTROMAGNETISMO",
    "ELECTRÓNICA Y ELECTRICIDAD",
    "EMPRENDIMIENTO E INNOVACIÓN",
    "EMPRENDIMIENTO Y GESTIÓN FINANCIERA",
    "EMPRENDIMIENTO Y LEGISLACIÓN LABORAL",
    "ERGONOMÍA",
    "ESTADÍSTICA Y PROBABILIDAD",
    "ESTRUCTURA DE DATOS",
    "ESTÁTICA Y DINÁMICA",
    "EVOLUCIÓN DE LAS TELECOMUNICACIONES",
    "FUNDAMENTOS DE BASE DE DATOS",
    "FUNDAMENTOS DE LA INGENIERÍA DE SOFTWARE",
    "FUNDAMENTOS DE PROGRAMACIÓN",
    "FUNDAMENTOS DE REDES Y COMUNICACIÓN DE DATOS",
    "FÍSICA",
    "FÍSICA APLICADA",
    "FÍSICA BÁSICA",
    "FÍSICA PARA ELECTRÓNICA",
    "GERENCIA EMPRESARIAL",
    "GESTIÓN AMBIENTAL",
    "GESTIÓN AMBIENTAL Y ENERGÍAS ALTERNATIVAS",
    "GESTIÓN DE BASE DE DATOS",
    "GESTIÓN DE CALIDAD",
    "GESTIÓN DE CALIDAD DEL SOFTWARE",
    "GESTIÓN DE OPERACIONES",
    "GESTIÓN DE PROYECTOS DE SOFTWARE",
    "GESTIÓN DE PRUEBAS E IMPLANTACIÓN DE SOFTWARE",
    "GESTIÓN DEL MANTENIMIENTO",
    "GESTIÓN POR PROCESOS",
    "GESTIÓN Y EVALUACIÓN DE PROYECTOS TI",
    "GOBIERNOS TI",
    "HIGIENE INDUSTRIAL",
    "INGENIERÍA DE MÉTODOS",
    "INGENIERÍA DE SOFTWARE",
    "INGENIERÍA ECONÓMICA PARA SOFTWARE",
    "INSTALACIONES ELÉCTRICAS",
    "INSTRUMENTACIÓN INDUSTRIAL",
    "INSTRUMENTACIÓN VIRTUAL",
    "INTEGRACIÓN DE SISTEMAS",
    "INTELIGENCIA ARTIFICIAL",
    "INTELIGENCIA DE NEGOCIOS",
    "INTERACCIÓN HOMBRE MÁQUINA",
    "INTERACCIÓN HUMANO / COMPUTADOR",
    "INTERACCIÓN HUMANO COMPUTADOR",
    "INTRODUCCIÓN A LA AUTOMATIZACIÓN",
    "INTRODUCCIÓN A LA INGENIERÍA INDUSTRIAL",
    "INTRODUCCIÓN A REDES",
    "INVESTIGACIÓN DE OPERACIONES",
    "INVESTIGACIÓN OPERATIVA",
    "LOGÍSTICA Y CADENA DE ABASTECIMIENTO",
    "LÍNEAS DE TRANSMISIÓN",
    "LÓGICA MATEMÁTICA",
    "MANEJO Y CONFIGURACIÓN DEL SOFTWARE",
    "MECANISMOS",
    "MECÁNICA BÁSICA",
    "MEDIDAS ELÉCTRICAS",
    "METODOLOGÍA DE LA INVESTIGACIÓN",
    "METODOLOGÍAS ÁGILES",
    "MODELAMIENTO Y DISEÑO DE SOFTWARE",
    "MÁQUINAS ELÉCTRICAS",
    "MÁQUINAS HERRAMIENTAS",
    "MÉTODOS NUMÉRICOS",
    "OPERACIONES UNITARIAS",
    "PATRONES DE SOFTWARE",
    "PLC'S",
    "PROBABILIDAD Y ESTADÍSTICA",
    "PROCESAMIENTO DIGITAL DE SEÑALES",
    "PROCESOS ESTOCASTICOS",
    "PROCESOS INDUSTRIALES",
    "PROGRAMACIÓN",
    "PROGRAMACIÓN AVANZADA",
    "PROGRAMACIÓN ORIENTADA A OBJETOS",
    "PROPAGACIÓN Y ANTENAS",
    "PROYECTOS DE TELECOMUNICACIONES",
    "QUÍMICA",
    "REALIDAD NACIONAL",
    "REDES",
    "REDES DE DATOS",
    "SEGURIDAD DE LA INFORMACIÓN EN REDES DE COMUNICACIÓN DE DATOS",
    "SEGURIDAD EN EL DESARROLLO DEL SOFTWARE",
    "SEGURIDAD INDUSTRIAL",
    "SEÑALES Y SISTEMAS",
    "SIMULACIÓN Y LABORATORIO",
    "SISTEMAS CAD/CAM",
    "SISTEMAS DE BASE DE DATOS DISTRIBUIDOS",
    "SISTEMAS DE CONTROL",
    "SISTEMAS DE SOPORTE DE DECISIONES",
    "SISTEMAS DE TELEFONÍA",
    "SISTEMAS DIGITALES",
    "SISTEMAS EMBEBIDOS",
    "SISTEMAS EMBEBIDOS (VLSI)",
    "SISTEMAS INALÁMBRICOS",
    "SISTEMAS LINEALES",
    "SISTEMAS OPERATIVOS",
    "SISTEMAS SATELITALES Y GPS",
    "SOFTWARE DE SIMULACIÓN",
    "TECNOLOGÍA DE LOS MATERIALES",
    "TECNOLOGÍAS DE LA INFORMACIÓN Y DE LA COMUNICACIÓN",
    "TECNOLOGÍAS DEL APRENDIZAJE",
    "TECNOLOGÍAS Y DESARROLLO WEB",
    "TELEVISIÓN DIGITAL",
    "TEORÍA ELECTROMAGNÉTICA",
    "TERMODINÁMICA",
    "ÁLGEBRA",
    "ÁLGEBRA LINEAL"
  ],
  "docentes": [
    {
      "nombreCompleto": "ALDÁS FLORES CLAY FERNANDO",
      "nombres": "Clay Fernando",
      "apellidos": "Aldas Flores",
      "cedula": "1800000018",
      "correo": "aldas.fernando@uta.edu.ec"
    },
    {
      "nombreCompleto": "ALDÁS SALAZAR DARWIN SANTIAGO",
      "nombres": "Darwin Santiago",
      "apellidos": "Aldas Salazar",
      "cedula": "1800000026",
      "correo": "aldas.santiago@uta.edu.ec"
    },
    {
      "nombreCompleto": "ALTAMIRANO MELÉNDEZ SANTIAGO MAURICIO",
      "nombres": "Santiago Mauricio",
      "apellidos": "Altamirano Melendez",
      "cedula": "1800000034",
      "correo": "altamirano.mauricio@uta.edu.ec"
    },
    {
      "nombreCompleto": "BALAREZO LÓPEZ JULIO ENRIQUE",
      "nombres": "Julio Enrique",
      "apellidos": "Balarezo Lopez",
      "cedula": "1800000042",
      "correo": "balarezo.enrique@uta.edu.ec"
    },
    {
      "nombreCompleto": "BENALCAZAR PALACIOS FREDDY GEOVANNY",
      "nombres": "Freddy Geovanny",
      "apellidos": "Benalcazar Palacios",
      "cedula": "1800000059",
      "correo": "benalcazar.geovanny@uta.edu.ec"
    },
    {
      "nombreCompleto": "BENITEZ ALDAS MARCOS RAPHAEL",
      "nombres": "Marcos Raphael",
      "apellidos": "Benitez Aldas",
      "cedula": "1800000067",
      "correo": "benitez.raphael@uta.edu.ec"
    },
    {
      "nombreCompleto": "BUENAÑO VALENCIA EDWIN HERNANDO",
      "nombres": "Edwin Hernando",
      "apellidos": "Buenano Valencia",
      "cedula": "1800000075",
      "correo": "buenano.hernando@uta.edu.ec"
    },
    {
      "nombreCompleto": "CAIZA CAIZABUANO JOSE RUBEN",
      "nombres": "Jose Ruben",
      "apellidos": "Caiza Caizabuano",
      "cedula": "1800000083",
      "correo": "caiza.ruben@uta.edu.ec"
    },
    {
      "nombreCompleto": "CARRILLO RIOS SANDRA LUCRECIA",
      "nombres": "Sandra Lucrecia",
      "apellidos": "Carrillo Rios",
      "cedula": "1800000091",
      "correo": "carrillo.lucrecia@uta.edu.ec"
    },
    {
      "nombreCompleto": "CASTRO MARTIN ANA PAMELA",
      "nombres": "Ana Pamela",
      "apellidos": "Castro Martin",
      "cedula": "1800000109",
      "correo": "castro.pamela@uta.edu.ec"
    },
    {
      "nombreCompleto": "CASTRO MAYORGA MARITZA ELIZABETH",
      "nombres": "Maritza Elizabeth",
      "apellidos": "Castro Mayorga",
      "cedula": "1800000117",
      "correo": "castro.elizabeth@uta.edu.ec"
    },
    {
      "nombreCompleto": "CAZORLA LOGROÑO MARIA FRANCISCA",
      "nombres": "Maria Francisca",
      "apellidos": "Cazorla Logrono",
      "cedula": "1800000125",
      "correo": "cazorla.francisca@uta.edu.ec"
    },
    {
      "nombreCompleto": "CHANGO SAILEMA WILSON GUSTAVO",
      "nombres": "Wilson Gustavo",
      "apellidos": "Chango Sailema",
      "cedula": "1800000133",
      "correo": "chango.gustavo@uta.edu.ec"
    },
    {
      "nombreCompleto": "CHICAIZA CASTILLO DENNIS VINICIO",
      "nombres": "Dennis Vinicio",
      "apellidos": "Chicaiza Castillo",
      "cedula": "1800000141",
      "correo": "chicaiza.vinicio@uta.edu.ec"
    },
    {
      "nombreCompleto": "CONTRERAS ROCHA CHRISTIAN JHONNY",
      "nombres": "Christian Jhonny",
      "apellidos": "Contreras Rocha",
      "cedula": "1800000158",
      "correo": "contreras.jhonny@uta.edu.ec"
    },
    {
      "nombreCompleto": "CORDOVA CORDOVA EDGAR PATRICIO",
      "nombres": "Edgar Patricio",
      "apellidos": "Cordova Cordova",
      "cedula": "1800000166",
      "correo": "cordova.patricio@uta.edu.ec"
    },
    {
      "nombreCompleto": "CORDOVA CORDOVA ÉDGAR PATRICIO",
      "nombres": "Edgar Patricio",
      "apellidos": "Cordova Cordova",
      "cedula": "1800000174",
      "correo": "cordova.patricio1@uta.edu.ec"
    },
    {
      "nombreCompleto": "CUJI RODRIGUEZ JULIO ENRIQUE",
      "nombres": "Julio Enrique",
      "apellidos": "Cuji Rodriguez",
      "cedula": "1800000182",
      "correo": "cuji.enrique@uta.edu.ec"
    },
    {
      "nombreCompleto": "ENCALADA RUIZ PATRICIO GERMÁN",
      "nombres": "Patricio German",
      "apellidos": "Encalada Ruiz",
      "cedula": "1800000190",
      "correo": "encalada.german@uta.edu.ec"
    },
    {
      "nombreCompleto": "ESCOBAR NARANJO JUAN CAMILO",
      "nombres": "Juan Camilo",
      "apellidos": "Escobar Naranjo",
      "cedula": "1800000208",
      "correo": "escobar.camilo@uta.edu.ec"
    },
    {
      "nombreCompleto": "FERNÁNDEZ PEÑA FÉLIX OSCAR",
      "nombres": "Felix Oscar",
      "apellidos": "Fernandez Pena",
      "cedula": "1800000216",
      "correo": "fernandez.oscar@uta.edu.ec"
    },
    {
      "nombreCompleto": "FLORES ASIMBAYA LUIS ANTONIO",
      "nombres": "Luis Antonio",
      "apellidos": "Flores Asimbaya",
      "cedula": "1800000224",
      "correo": "flores.antonio@uta.edu.ec"
    },
    {
      "nombreCompleto": "GARCIA CARRILLO MARIO GEOVANNI",
      "nombres": "Mario Geovanni",
      "apellidos": "Garcia Carrillo",
      "cedula": "1800000232",
      "correo": "garcia.geovanni@uta.edu.ec"
    },
    {
      "nombreCompleto": "GARCIA SÁNCHEZ MARCELO VLADIMIR",
      "nombres": "Marcelo Vladimir",
      "apellidos": "Garcia Sanchez",
      "cedula": "1800000240",
      "correo": "garcia.vladimir@uta.edu.ec"
    },
    {
      "nombreCompleto": "GORDÓN GALLEGOS CARLOS DIEGO",
      "nombres": "Carlos Diego",
      "apellidos": "Gordon Gallegos",
      "cedula": "1800000257",
      "correo": "gordon.diego@uta.edu.ec"
    },
    {
      "nombreCompleto": "GUACHIMBOZA VILLALBA MARCO VINICIO",
      "nombres": "Marco Vinicio",
      "apellidos": "Guachimboza Villalba",
      "cedula": "1800000265",
      "correo": "guachimboza.vinicio@uta.edu.ec"
    },
    {
      "nombreCompleto": "GUAMÁN MOLINA JESUS ISRAEL",
      "nombres": "Jesus Israel",
      "apellidos": "Guaman Molina",
      "cedula": "1800000273",
      "correo": "guaman.israel@uta.edu.ec"
    },
    {
      "nombreCompleto": "GUAMÁN MOLINA JESÚS ISRAEL",
      "nombres": "Jesus Israel",
      "apellidos": "Guaman Molina",
      "cedula": "1800000281",
      "correo": "guaman.israel1@uta.edu.ec"
    },
    {
      "nombreCompleto": "GUEVARA AULESTIA DAVID OMAR",
      "nombres": "David Omar",
      "apellidos": "Guevara Aulestia",
      "cedula": "1800000299",
      "correo": "guevara.omar@uta.edu.ec"
    },
    {
      "nombreCompleto": "GUILCAPI MOSQUERA JAIME RODRIGO",
      "nombres": "Jaime Rodrigo",
      "apellidos": "Guilcapi Mosquera",
      "cedula": "1800000307",
      "correo": "guilcapi.rodrigo@uta.edu.ec"
    },
    {
      "nombreCompleto": "IBARRA TORRES OSCAR FERNANDO",
      "nombres": "Oscar Fernando",
      "apellidos": "Ibarra Torres",
      "cedula": "1800000315",
      "correo": "ibarra.fernando@uta.edu.ec"
    },
    {
      "nombreCompleto": "JARA MOYA SANTIAGO DAVID",
      "nombres": "Santiago David",
      "apellidos": "Jara Moya",
      "cedula": "1800000323",
      "correo": "jara.david@uta.edu.ec"
    },
    {
      "nombreCompleto": "JEREZ MAYORGA DANIEL SEBASTIAN",
      "nombres": "Daniel Sebastian",
      "apellidos": "Jerez Mayorga",
      "cedula": "1800000331",
      "correo": "jerez.sebastian@uta.edu.ec"
    },
    {
      "nombreCompleto": "LEMA CHICAIZA FREDDY ROBERTO",
      "nombres": "Freddy Roberto",
      "apellidos": "Lema Chicaiza",
      "cedula": "1800000349",
      "correo": "lema.roberto@uta.edu.ec"
    },
    {
      "nombreCompleto": "LOPEZ FLORES MAURICIO XAVIER",
      "nombres": "Mauricio Xavier",
      "apellidos": "Lopez Flores",
      "cedula": "1800000356",
      "correo": "lopez.xavier@uta.edu.ec"
    },
    {
      "nombreCompleto": "LÓPEZ ARBOLEDA JESSICA PAOLA",
      "nombres": "Jessica Paola",
      "apellidos": "Lopez Arboleda",
      "cedula": "1800000364",
      "correo": "lopez.paola@uta.edu.ec"
    },
    {
      "nombreCompleto": "LÓPEZ FLORES XAVIER MAURICIO",
      "nombres": "Xavier Mauricio",
      "apellidos": "Lopez Flores",
      "cedula": "1800000372",
      "correo": "lopez.mauricio@uta.edu.ec"
    },
    {
      "nombreCompleto": "MAIGUA QUINTEROS ALEX JAVIER",
      "nombres": "Alex Javier",
      "apellidos": "Maigua Quinteros",
      "cedula": "1800000380",
      "correo": "maigua.javier@uta.edu.ec"
    },
    {
      "nombreCompleto": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "nombres": "Daniel Alejandro",
      "apellidos": "Maldonado Ruiz",
      "cedula": "1800000398",
      "correo": "maldonado.alejandro@uta.edu.ec"
    },
    {
      "nombreCompleto": "MANZANO VILLAFUERTE VICTOR SANTIAGO",
      "nombres": "Victor Santiago",
      "apellidos": "Manzano Villafuerte",
      "cedula": "1800000406",
      "correo": "manzano.santiago@uta.edu.ec"
    },
    {
      "nombreCompleto": "MARIÑO RIVERA CHRISTIAN JOSÉ",
      "nombres": "Christian Jose",
      "apellidos": "Marino Rivera",
      "cedula": "1800000414",
      "correo": "marino.jose@uta.edu.ec"
    },
    {
      "nombreCompleto": "MAYORGA MAYORGA FRANKLIN OSWALDO",
      "nombres": "Franklin Oswaldo",
      "apellidos": "Mayorga Mayorga",
      "cedula": "1800000422",
      "correo": "mayorga.oswaldo@uta.edu.ec"
    },
    {
      "nombreCompleto": "MINIGUANO MINIGUANO LIVIO DANILO",
      "nombres": "Livio Danilo",
      "apellidos": "Miniguano Miniguano",
      "cedula": "1800000430",
      "correo": "miniguano.danilo@uta.edu.ec"
    },
    {
      "nombreCompleto": "MORALES LOZADA JOSE VICENTE",
      "nombres": "Jose Vicente",
      "apellidos": "Morales Lozada",
      "cedula": "1800000448",
      "correo": "morales.vicente@uta.edu.ec"
    },
    {
      "nombreCompleto": "MORALES LOZADA JOSÉ VICENTE",
      "nombres": "Jose Vicente",
      "apellidos": "Morales Lozada",
      "cedula": "1800000455",
      "correo": "morales.vicente1@uta.edu.ec"
    },
    {
      "nombreCompleto": "MORALES OÑATE BOLÍVAR EFRAÍN",
      "nombres": "Bolivar Efrain",
      "apellidos": "Morales Onate",
      "cedula": "1800000463",
      "correo": "morales.efrain@uta.edu.ec"
    },
    {
      "nombreCompleto": "MORALES PERRAZO LUIS ALBERTO",
      "nombres": "Luis Alberto",
      "apellidos": "Morales Perrazo",
      "cedula": "1800000471",
      "correo": "morales.alberto@uta.edu.ec"
    },
    {
      "nombreCompleto": "NARANJO AVALOS HERNAN FABRICIO",
      "nombres": "Hernan Fabricio",
      "apellidos": "Naranjo Avalos",
      "cedula": "1800000489",
      "correo": "naranjo.fabricio@uta.edu.ec"
    },
    {
      "nombreCompleto": "NARANJO CHIRIBOGA ISRAEL ERNESTO",
      "nombres": "Israel Ernesto",
      "apellidos": "Naranjo Chiriboga",
      "cedula": "1800000497",
      "correo": "naranjo.ernesto@uta.edu.ec"
    },
    {
      "nombreCompleto": "NOGALES PORTERO RUBEN EDUARDO",
      "nombres": "Ruben Eduardo",
      "apellidos": "Nogales Portero",
      "cedula": "1800000505",
      "correo": "nogales.eduardo@uta.edu.ec"
    },
    {
      "nombreCompleto": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "nombres": "Carlos Israel",
      "apellidos": "Nunez Miranda",
      "cedula": "1800000513",
      "correo": "nunez.israel@uta.edu.ec"
    },
    {
      "nombreCompleto": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR",
      "nombres": "William Wladimir",
      "apellidos": "Ortiz Fernandez",
      "cedula": "1800000521",
      "correo": "ortiz.wladimir@uta.edu.ec"
    },
    {
      "nombreCompleto": "ORTIZ GUERRERO DAYSI MARGARITA",
      "nombres": "Daysi Margarita",
      "apellidos": "Ortiz Guerrero",
      "cedula": "1800000539",
      "correo": "ortiz.margarita@uta.edu.ec"
    },
    {
      "nombreCompleto": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "nombres": "Victor Filiberto",
      "apellidos": "Penafiel Gaibor",
      "cedula": "1800000547",
      "correo": "penafiel.filiberto@uta.edu.ec"
    },
    {
      "nombreCompleto": "POMAQUERO MORENO LUIS ALFREDO",
      "nombres": "Luis Alfredo",
      "apellidos": "Pomaquero Moreno",
      "cedula": "1800000554",
      "correo": "pomaquero.alfredo@uta.edu.ec"
    },
    {
      "nombreCompleto": "REYES BEDOYA DONALD EDUARDO",
      "nombres": "Donald Eduardo",
      "apellidos": "Reyes Bedoya",
      "cedula": "1800000562",
      "correo": "reyes.eduardo@uta.edu.ec"
    },
    {
      "nombreCompleto": "REYES VASQUEZ JOHN PAUL",
      "nombres": "John Paul",
      "apellidos": "Reyes Vasquez",
      "cedula": "1800000570",
      "correo": "reyes.paul@uta.edu.ec"
    },
    {
      "nombreCompleto": "ROBALINO PEÑA EDGAR FREDDY",
      "nombres": "Edgar Freddy",
      "apellidos": "Robalino Pena",
      "cedula": "1800000588",
      "correo": "robalino.freddy@uta.edu.ec"
    },
    {
      "nombreCompleto": "ROSERO MANTILLA CESAR ANIBAL",
      "nombres": "Cesar Anibal",
      "apellidos": "Rosero Mantilla",
      "cedula": "1800000596",
      "correo": "rosero.anibal@uta.edu.ec"
    },
    {
      "nombreCompleto": "RUIZ BANDA JAIME BOLIVAR",
      "nombres": "Jaime Bolivar",
      "apellidos": "Ruiz Banda",
      "cedula": "1800000604",
      "correo": "ruiz.bolivar@uta.edu.ec"
    },
    {
      "nombreCompleto": "SALAZAR ESCOBAR FABIAN RODRIGO",
      "nombres": "Fabian Rodrigo",
      "apellidos": "Salazar Escobar",
      "cedula": "1800000612",
      "correo": "salazar.rodrigo@uta.edu.ec"
    },
    {
      "nombreCompleto": "SALAZAR LOGROÑO FRANKLIN WILFRIDO",
      "nombres": "Franklin Wilfrido",
      "apellidos": "Salazar Logrono",
      "cedula": "1800000620",
      "correo": "salazar.wilfrido@uta.edu.ec"
    },
    {
      "nombreCompleto": "SANTAMARIA VILLACIS MARLON ANTONIO",
      "nombres": "Marlon Antonio",
      "apellidos": "Santamaria Villacis",
      "cedula": "1800000638",
      "correo": "santamaria.antonio@uta.edu.ec"
    },
    {
      "nombreCompleto": "SEVILLA ABARCA MARTHA ESPERANZA",
      "nombres": "Martha Esperanza",
      "apellidos": "Sevilla Abarca",
      "cedula": "1800000646",
      "correo": "sevilla.esperanza@uta.edu.ec"
    },
    {
      "nombreCompleto": "SOLIS SALAZAR JUAN SEBASTIÁN",
      "nombres": "Juan Sebastian",
      "apellidos": "Solis Salazar",
      "cedula": "1800000653",
      "correo": "solis.sebastian@uta.edu.ec"
    },
    {
      "nombreCompleto": "SÁNCHEZ BENÍTEZ CLARA AUGUSTA",
      "nombres": "Clara Augusta",
      "apellidos": "Sanchez Benitez",
      "cedula": "1800000661",
      "correo": "sanchez.augusta@uta.edu.ec"
    },
    {
      "nombreCompleto": "SÁNCHEZ ROSERO CARLOS HUMBERTO",
      "nombres": "Carlos Humberto",
      "apellidos": "Sanchez Rosero",
      "cedula": "1800000679",
      "correo": "sanchez.humberto@uta.edu.ec"
    },
    {
      "nombreCompleto": "TIGRE ORTEGA FRANKLIN GEOVANNY",
      "nombres": "Franklin Geovanny",
      "apellidos": "Tigre Ortega",
      "cedula": "1800000687",
      "correo": "tigre.geovanny@uta.edu.ec"
    },
    {
      "nombreCompleto": "TORRES ABRIL PAULO CESAR",
      "nombres": "Paulo Cesar",
      "apellidos": "Torres Abril",
      "cedula": "1800000695",
      "correo": "torres.cesar@uta.edu.ec"
    },
    {
      "nombreCompleto": "TORRES VALVERDE LEONARDO DAVID",
      "nombres": "Leonardo David",
      "apellidos": "Torres Valverde",
      "cedula": "1800000703",
      "correo": "torres.david@uta.edu.ec"
    },
    {
      "nombreCompleto": "TUBÓN NUÑEZ EDITH ELENA",
      "nombres": "Edith Elena",
      "apellidos": "Tubon Nunez",
      "cedula": "1800000711",
      "correo": "tubon.elena@uta.edu.ec"
    },
    {
      "nombreCompleto": "UREÑA AGUIRRE JEANETTE DEL PILAR",
      "nombres": "Jeanette Del Pilar",
      "apellidos": "Urena Aguirre",
      "cedula": "1800000729",
      "correo": "urena.pilar@uta.edu.ec"
    },
    {
      "nombreCompleto": "URRUTIA URRUTIA ELSA PILAR",
      "nombres": "Elsa Pilar",
      "apellidos": "Urrutia Urrutia",
      "cedula": "1800000737",
      "correo": "urrutia.pilar@uta.edu.ec"
    },
    {
      "nombreCompleto": "URRUTIA URRUTIA FERNANDO",
      "nombres": "Urrutia Fernando",
      "apellidos": "Urrutia",
      "cedula": "1800000745",
      "correo": "urrutia.fernando@uta.edu.ec"
    },
    {
      "nombreCompleto": "URVINA BARRIONUEVO KLEVER RENATO",
      "nombres": "Klever Renato",
      "apellidos": "Urvina Barrionuevo",
      "cedula": "1800000752",
      "correo": "urvina.renato@uta.edu.ec"
    },
    {
      "nombreCompleto": "VALENCIA VARGAS SUSANA ELIZABETH",
      "nombres": "Susana Elizabeth",
      "apellidos": "Valencia Vargas",
      "cedula": "1800000760",
      "correo": "valencia.elizabeth@uta.edu.ec"
    },
    {
      "nombreCompleto": "VARGAS GUEVARA CARLOS LUIS",
      "nombres": "Carlos Luis",
      "apellidos": "Vargas Guevara",
      "cedula": "1800000778",
      "correo": "vargas.luis@uta.edu.ec"
    },
    {
      "nombreCompleto": "VARGAS PAREDES JAVIER SANTIAGO",
      "nombres": "Javier Santiago",
      "apellidos": "Vargas Paredes",
      "cedula": "1800000786",
      "correo": "vargas.santiago@uta.edu.ec"
    },
    {
      "nombreCompleto": "ZAMBRANO VALVERDE TATIANA PAOLA",
      "nombres": "Tatiana Paola",
      "apellidos": "Zambrano Valverde",
      "cedula": "1800000794",
      "correo": "zambrano.paola@uta.edu.ec"
    },
    {
      "nombreCompleto": "ÁLVAREZ MAYORGA EDISON HOMERO",
      "nombres": "Edison Homero",
      "apellidos": "Alvarez Mayorga",
      "cedula": "1800000802",
      "correo": "alvarez.homero@uta.edu.ec"
    }
  ],
  "paralelos": [
    {
      "nom_par": "B",
      "materia": "MODELAMIENTO Y DISEÑO DE SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "TORRES VALVERDE LEONARDO DAVID"
    },
    {
      "nom_par": "B",
      "materia": "ESTRUCTURA DE DATOS",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "CAIZA CAIZABUANO JOSE RUBEN"
    },
    {
      "nom_par": "A",
      "materia": "INTELIGENCIA DE NEGOCIOS",
      "carrera": "Software",
      "nivelNumero": 6,
      "docente": "NOGALES PORTERO RUBEN EDUARDO"
    },
    {
      "nom_par": "B",
      "materia": "PROGRAMACIÓN ORIENTADA A OBJETOS",
      "carrera": "Software",
      "nivelNumero": 2,
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN"
    },
    {
      "nom_par": "A",
      "materia": "REDES",
      "carrera": "Software",
      "nivelNumero": 4,
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO"
    },
    {
      "nom_par": "A",
      "materia": "INTRODUCCIÓN A REDES",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 3,
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO"
    },
    {
      "nom_par": "A",
      "materia": "PROGRAMACIÓN",
      "carrera": "Software",
      "nivelNumero": 8,
      "docente": "RUIZ BANDA JAIME BOLIVAR"
    },
    {
      "nom_par": "B",
      "materia": "PROGRAMACIÓN",
      "carrera": "Industrial",
      "nivelNumero": 2,
      "docente": "RUIZ BANDA JAIME BOLIVAR"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS OPERATIVOS",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 3,
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN"
    },
    {
      "nom_par": "B",
      "materia": "SISTEMAS OPERATIVOS",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN"
    },
    {
      "nom_par": "B",
      "materia": "INTRODUCCIÓN A REDES",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO"
    },
    {
      "nom_par": "A",
      "materia": "INGENIERÍA ECONÓMICA PARA SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 8,
      "docente": "JARA MOYA SANTIAGO DAVID"
    },
    {
      "nom_par": "B",
      "materia": "SISTEMAS OPERATIVOS",
      "carrera": "Software",
      "nivelNumero": 2,
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO"
    },
    {
      "nom_par": "A",
      "materia": "PROGRAMACIÓN AVANZADA",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 3,
      "docente": "NARANJO AVALOS HERNAN FABRICIO"
    },
    {
      "nom_par": "B",
      "materia": "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN",
      "carrera": "Software",
      "nivelNumero": 1,
      "docente": "CAIZA CAIZABUANO JOSE RUBEN"
    },
    {
      "nom_par": "A",
      "materia": "PROGRAMACIÓN",
      "carrera": "Industrial",
      "nivelNumero": 2,
      "docente": "RUIZ BANDA JAIME BOLIVAR"
    },
    {
      "nom_par": "A",
      "materia": "APLICACIONES ORIENTADAS A SERVICIOS",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL"
    },
    {
      "nom_par": "B",
      "materia": "COMPUTACIÓN VISUAL",
      "carrera": "Software",
      "nivelNumero": 4,
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL"
    },
    {
      "nom_par": "B",
      "materia": "PROGRAMACIÓN ORIENTADA A OBJETOS",
      "carrera": "Software",
      "nivelNumero": 4,
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL"
    },
    {
      "nom_par": "B",
      "materia": "REDES",
      "carrera": "Software",
      "nivelNumero": 4,
      "docente": "CHANGO SAILEMA WILSON GUSTAVO"
    },
    {
      "nom_par": "A",
      "materia": "APLICACIONES ORIENTADAS A SERVICIOS",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 3,
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL"
    },
    {
      "nom_par": "A",
      "materia": "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 3,
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL"
    },
    {
      "nom_par": "A",
      "materia": "COMPUTACIÓN VISUAL",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 3,
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL"
    },
    {
      "nom_par": "A",
      "materia": "COMPUTACIÓN VISUAL",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 2,
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL"
    },
    {
      "nom_par": "A",
      "materia": "REDES",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 2,
      "docente": "CHANGO SAILEMA WILSON GUSTAVO"
    },
    {
      "nom_par": "A",
      "materia": "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN",
      "carrera": "Software",
      "nivelNumero": 1,
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL"
    },
    {
      "nom_par": "A",
      "materia": "COMPUTACIÓN VISUAL",
      "carrera": "Software",
      "nivelNumero": 4,
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS OPERATIVOS",
      "carrera": "Software",
      "nivelNumero": 4,
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO"
    },
    {
      "nom_par": "B",
      "materia": "SISTEMAS OPERATIVOS",
      "carrera": "Software",
      "nivelNumero": 4,
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO"
    },
    {
      "nom_par": "B",
      "materia": "BASE DE DATOS",
      "carrera": "Software",
      "nivelNumero": 4,
      "docente": "MORALES LOZADA JOSÉ VICENTE"
    },
    {
      "nom_par": "B",
      "materia": "PROGRAMACIÓN ORIENTADA A OBJETOS",
      "carrera": "Software",
      "nivelNumero": 2,
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL"
    },
    {
      "nom_par": "A",
      "materia": "BASE DE DATOS",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 2,
      "docente": "MORALES LOZADA JOSÉ VICENTE"
    },
    {
      "nom_par": "A",
      "materia": "FUNDAMENTOS DE PROGRAMACIÓN",
      "carrera": "Robótica",
      "nivelNumero": 1,
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO"
    },
    {
      "nom_par": "A",
      "materia": "METODOLOGÍA DE LA INVESTIGACIÓN",
      "carrera": "Software",
      "nivelNumero": 2,
      "docente": "REYES VASQUEZ JOHN PAUL"
    },
    {
      "nom_par": "A",
      "materia": "PROGRAMACIÓN AVANZADA",
      "carrera": "Robótica",
      "nivelNumero": 2,
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO"
    },
    {
      "nom_par": "A",
      "materia": "APLICACIONES ORIENTADAS A SERVICIOS",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 7,
      "docente": "VARGAS PAREDES JAVIER SANTIAGO"
    },
    {
      "nom_par": "A",
      "materia": "PROGRAMACIÓN AVANZADA",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 7,
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO"
    },
    {
      "nom_par": "A",
      "materia": "AUDITORÍA DE SISTEMAS DE INFORMACIÓN",
      "carrera": "Software",
      "nivelNumero": 7,
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE"
    },
    {
      "nom_par": "A",
      "materia": "DISEÑO DE PROYECTOS",
      "carrera": "Software",
      "nivelNumero": 8,
      "docente": "NOGALES PORTERO RUBEN EDUARDO"
    },
    {
      "nom_par": "A",
      "materia": "SOFTWARE DE SIMULACIÓN",
      "carrera": "Software",
      "nivelNumero": 8,
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH"
    },
    {
      "nom_par": "B",
      "materia": "SISTEMAS DE SOPORTE DE DECISIONES",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "VARGAS PAREDES JAVIER SANTIAGO"
    },
    {
      "nom_par": "A",
      "materia": "SOFTWARE DE SIMULACIÓN",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 4,
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH"
    },
    {
      "nom_par": "A",
      "materia": "GESTIÓN DE PROYECTOS DE SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 7,
      "docente": "TORRES ABRIL PAULO CESAR"
    },
    {
      "nom_par": "A",
      "materia": "EMPRENDIMIENTO Y GESTIÓN FINANCIERA",
      "carrera": "Software",
      "nivelNumero": 7,
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN"
    },
    {
      "nom_par": "A",
      "materia": "INTEGRACIÓN DE SISTEMAS",
      "carrera": "Software",
      "nivelNumero": 7,
      "docente": "MAIGUA QUINTEROS ALEX JAVIER"
    },
    {
      "nom_par": "A",
      "materia": "AUDITORÍA DE TI",
      "carrera": "Software",
      "nivelNumero": 7,
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS DE BASE DE DATOS DISTRIBUIDOS",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 7,
      "docente": "MAIGUA QUINTEROS ALEX JAVIER"
    },
    {
      "nom_par": "A",
      "materia": "TECNOLOGÍAS DEL APRENDIZAJE",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 7,
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO"
    },
    {
      "nom_par": "A",
      "materia": "AUDITORÍA DE SISTEMAS DE INFORMACIÓN",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 5,
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE"
    },
    {
      "nom_par": "A",
      "materia": "GESTIÓN DE PROYECTOS DE SOFTWARE",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 5,
      "docente": "TORRES ABRIL PAULO CESAR"
    },
    {
      "nom_par": "A",
      "materia": "GESTIÓN DE PROYECTOS DE SOFTWARE",
      "carrera": "Robótica",
      "nivelNumero": 1,
      "docente": "TORRES ABRIL PAULO CESAR"
    },
    {
      "nom_par": "A",
      "materia": "AUDITORÍA DE TI",
      "carrera": "Robótica",
      "nivelNumero": 1,
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE"
    },
    {
      "nom_par": "A",
      "materia": "INTEGRACIÓN DE SISTEMAS",
      "carrera": "Robótica",
      "nivelNumero": 1,
      "docente": "MAIGUA QUINTEROS ALEX JAVIER"
    },
    {
      "nom_par": "A",
      "materia": "METODOLOGÍA DE LA INVESTIGACIÓN",
      "carrera": "Software",
      "nivelNumero": 7,
      "docente": "GUAMÁN MOLINA JESÚS ISRAEL"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS DE BASE DE DATOS DISTRIBUIDOS",
      "carrera": "Software",
      "nivelNumero": 7,
      "docente": "MAIGUA QUINTEROS ALEX JAVIER"
    },
    {
      "nom_par": "A",
      "materia": "TECNOLOGÍAS DEL APRENDIZAJE",
      "carrera": "Software",
      "nivelNumero": 7,
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO"
    },
    {
      "nom_par": "B",
      "materia": "METODOLOGÍA DE LA INVESTIGACIÓN",
      "carrera": "Software",
      "nivelNumero": 2,
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL"
    },
    {
      "nom_par": "B",
      "materia": "PATRONES DE SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "ALDÁS FLORES CLAY FERNANDO"
    },
    {
      "nom_par": "B",
      "materia": "APLICACIONES ORIENTADAS A SERVICIOS",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "VARGAS PAREDES JAVIER SANTIAGO"
    },
    {
      "nom_par": "B",
      "materia": "GESTIÓN DE CALIDAD",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "SEVILLA ABARCA MARTHA ESPERANZA"
    },
    {
      "nom_par": "B",
      "materia": "INTERACCIÓN HOMBRE MÁQUINA",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "VARGAS PAREDES JAVIER SANTIAGO"
    },
    {
      "nom_par": "A",
      "materia": "GOBIERNOS TI",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 2,
      "docente": "MORALES LOZADA JOSÉ VICENTE"
    },
    {
      "nom_par": "B",
      "materia": "PATRONES DE SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "VARGAS PAREDES JAVIER SANTIAGO"
    },
    {
      "nom_par": "A",
      "materia": "GOBIERNOS TI",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 6,
      "docente": "MORALES LOZADA JOSÉ VICENTE"
    },
    {
      "nom_par": "B",
      "materia": "INTERACCIÓN HUMANO COMPUTADOR",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "CAIZA CAIZABUANO JOSE RUBEN"
    },
    {
      "nom_par": "B",
      "materia": "FUNDAMENTOS DE LA INGENIERÍA DE SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 2,
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE"
    },
    {
      "nom_par": "A",
      "materia": "FUNDAMENTOS DE LA INGENIERÍA DE SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 2,
      "docente": "IBARRA TORRES OSCAR FERNANDO"
    },
    {
      "nom_par": "A",
      "materia": "BASE DE DATOS",
      "carrera": "Software",
      "nivelNumero": 4,
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO"
    },
    {
      "nom_par": "A",
      "materia": "CONMUTACIÓN Y ENRUTAMIENTO AVANZADO",
      "carrera": "Software",
      "nivelNumero": 4,
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO"
    },
    {
      "nom_par": "A",
      "materia": "APLICACIONES MÓVILES",
      "carrera": "Software",
      "nivelNumero": 4,
      "docente": "ALDÁS FLORES CLAY FERNANDO"
    },
    {
      "nom_par": "A",
      "materia": "INTRODUCCIÓN A REDES",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 5,
      "docente": "URRUTIA URRUTIA ELSA PILAR"
    },
    {
      "nom_par": "A",
      "materia": "MODELAMIENTO Y DISEÑO DE SOFTWARE",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 3,
      "docente": "TORRES VALVERDE LEONARDO DAVID"
    },
    {
      "nom_par": "A",
      "materia": "FUNDAMENTOS DE BASE DE DATOS",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 5,
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO"
    },
    {
      "nom_par": "A",
      "materia": "BASE DE DATOS",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 6,
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO"
    },
    {
      "nom_par": "A",
      "materia": "GESTIÓN Y EVALUACIÓN DE PROYECTOS TI",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "URVINA BARRIONUEVO KLEVER RENATO"
    },
    {
      "nom_par": "B",
      "materia": "TECNOLOGÍAS Y DESARROLLO WEB",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "ALDÁS FLORES CLAY FERNANDO"
    },
    {
      "nom_par": "A",
      "materia": "FUNDAMENTOS DE BASE DE DATOS",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 3,
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO"
    },
    {
      "nom_par": "A",
      "materia": "APLICACIONES MÓVILES",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 3,
      "docente": "ALDÁS FLORES CLAY FERNANDO"
    },
    {
      "nom_par": "A",
      "materia": "GESTIÓN DE BASE DE DATOS",
      "carrera": "Software",
      "nivelNumero": 4,
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO"
    },
    {
      "nom_par": "A",
      "materia": "CONMUTACIÓN Y ENRUTAMIENTO BÁSICO",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 5,
      "docente": "URRUTIA URRUTIA ELSA PILAR"
    },
    {
      "nom_par": "A",
      "materia": "TECNOLOGÍAS Y DESARROLLO WEB",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 3,
      "docente": "ALDÁS FLORES CLAY FERNANDO"
    },
    {
      "nom_par": "A",
      "materia": "APLICACIONES MÓVILES",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 6,
      "docente": "ALDÁS FLORES CLAY FERNANDO"
    },
    {
      "nom_par": "A",
      "materia": "GESTIÓN DE BASE DE DATOS",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 6,
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO"
    },
    {
      "nom_par": "A",
      "materia": "GESTIÓN DE BASE DE DATOS",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 4,
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO"
    },
    {
      "nom_par": "A",
      "materia": "GESTIÓN Y EVALUACIÓN DE PROYECTOS TI",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 5,
      "docente": "URVINA BARRIONUEVO KLEVER RENATO"
    },
    {
      "nom_par": "A",
      "materia": "DESARROLLO ASISTIDO POR SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 7,
      "docente": "JARA MOYA SANTIAGO DAVID"
    },
    {
      "nom_par": "A",
      "materia": "INTELIGENCIA ARTIFICIAL",
      "carrera": "Software",
      "nivelNumero": 7,
      "docente": "NOGALES PORTERO RUBEN EDUARDO"
    },
    {
      "nom_par": "A",
      "materia": "METODOLOGÍAS ÁGILES",
      "carrera": "Software",
      "nivelNumero": 4,
      "docente": "NARANJO AVALOS HERNAN FABRICIO"
    },
    {
      "nom_par": "A",
      "materia": "PROBABILIDAD Y ESTADÍSTICA",
      "carrera": "Software",
      "nivelNumero": 7,
      "docente": "ALDÁS SALAZAR DARWIN SANTIAGO"
    },
    {
      "nom_par": "A",
      "materia": "MODELAMIENTO Y DISEÑO DE SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 7,
      "docente": "TORRES VALVERDE LEONARDO DAVID"
    },
    {
      "nom_par": "B",
      "materia": "METODOLOGÍAS ÁGILES",
      "carrera": "Software",
      "nivelNumero": 2,
      "docente": "NARANJO AVALOS HERNAN FABRICIO"
    },
    {
      "nom_par": "B",
      "materia": "METODOLOGÍAS ÁGILES",
      "carrera": "Software",
      "nivelNumero": 4,
      "docente": "NARANJO AVALOS HERNAN FABRICIO"
    },
    {
      "nom_par": "B",
      "materia": "BASE DE DATOS",
      "carrera": "Software",
      "nivelNumero": 4,
      "docente": "GUACHIMBOZA VILLALBA MARCO VINICIO"
    },
    {
      "nom_par": "A",
      "materia": "BASE DE DATOS",
      "carrera": "Software",
      "nivelNumero": 6,
      "docente": "GUACHIMBOZA VILLALBA MARCO VINICIO"
    },
    {
      "nom_par": "A",
      "materia": "MODELAMIENTO Y DISEÑO DE SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "TORRES VALVERDE LEONARDO DAVID"
    },
    {
      "nom_par": "B",
      "materia": "MANEJO Y CONFIGURACIÓN DEL SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 4,
      "docente": "JARA MOYA SANTIAGO DAVID"
    },
    {
      "nom_par": "A",
      "materia": "GESTIÓN DE CALIDAD DEL SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 7,
      "docente": "MAIGUA QUINTEROS ALEX JAVIER"
    },
    {
      "nom_par": "A",
      "materia": "MANEJO Y CONFIGURACIÓN DEL SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 4,
      "docente": "JARA MOYA SANTIAGO DAVID"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS DE SOPORTE DE DECISIONES",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "ÁLVAREZ MAYORGA EDISON HOMERO"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS OPERATIVOS",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN"
    },
    {
      "nom_par": "A",
      "materia": "ADMINISTRACIÓN DE BASE DE DATOS",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO"
    },
    {
      "nom_par": "B",
      "materia": "INGENIERÍA DE SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 4,
      "docente": "IBARRA TORRES OSCAR FERNANDO"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS DE SOPORTE DE DECISIONES",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 7,
      "docente": "ÁLVAREZ MAYORGA EDISON HOMERO"
    },
    {
      "nom_par": "A",
      "materia": "PROGRAMACIÓN AVANZADA",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 7,
      "docente": "ROBALINO PEÑA EDGAR FREDDY"
    },
    {
      "nom_par": "A",
      "materia": "BASE DE DATOS",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 6,
      "docente": "GUACHIMBOZA VILLALBA MARCO VINICIO"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS DE SOPORTE DE DECISIONES",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 6,
      "docente": "ÁLVAREZ MAYORGA EDISON HOMERO"
    },
    {
      "nom_par": "A",
      "materia": "CONMUTACIÓN Y ENRUTAMIENTO AVANZADO",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 4,
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO"
    },
    {
      "nom_par": "A",
      "materia": "INTELIGENCIA DE NEGOCIOS",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "ÁLVAREZ MAYORGA EDISON HOMERO"
    },
    {
      "nom_par": "A",
      "materia": "INTERACCIÓN HUMANO COMPUTADOR",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "CAIZA CAIZABUANO JOSE RUBEN"
    },
    {
      "nom_par": "A",
      "materia": "INTERACCIÓN HUMANO / COMPUTADOR",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "CAIZA CAIZABUANO JOSE RUBEN"
    },
    {
      "nom_par": "B",
      "materia": "DISEÑO DE PROYECTOS",
      "carrera": "Software",
      "nivelNumero": 4,
      "docente": "NOGALES PORTERO RUBEN EDUARDO"
    },
    {
      "nom_par": "A",
      "materia": "PATRONES DE SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "VARGAS PAREDES JAVIER SANTIAGO"
    },
    {
      "nom_par": "A",
      "materia": "METODOLOGÍA DE LA INVESTIGACIÓN",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL"
    },
    {
      "nom_par": "A",
      "materia": "INGENIERÍA DE SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 8,
      "docente": "IBARRA TORRES OSCAR FERNANDO"
    },
    {
      "nom_par": "A",
      "materia": "ADMINISTRACIÓN DE BASE DE DATOS",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 6,
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO"
    },
    {
      "nom_par": "A",
      "materia": "INTELIGENCIA DE NEGOCIOS",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 7,
      "docente": "ÁLVAREZ MAYORGA EDISON HOMERO"
    },
    {
      "nom_par": "A",
      "materia": "PROGRAMACIÓN ORIENTADA A OBJETOS",
      "carrera": "Software",
      "nivelNumero": 2,
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR"
    },
    {
      "nom_par": "A",
      "materia": "METODOLOGÍA DE LA INVESTIGACIÓN",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 1,
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE"
    },
    {
      "nom_par": "A",
      "materia": "ESTRUCTURA DE DATOS",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 1,
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR"
    },
    {
      "nom_par": "B",
      "materia": "ESTRUCTURA DE DATOS",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 1,
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR"
    },
    {
      "nom_par": "B",
      "materia": "MODELAMIENTO Y DISEÑO DE SOFTWARE",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 1,
      "docente": "TORRES VALVERDE LEONARDO DAVID"
    },
    {
      "nom_par": "A",
      "materia": "FUNDAMENTOS DE LA INGENIERÍA DE SOFTWARE",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 2,
      "docente": "IBARRA TORRES OSCAR FERNANDO"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS OPERATIVOS",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 2,
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN"
    },
    {
      "nom_par": "A",
      "materia": "REALIDAD NACIONAL",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 2,
      "docente": "MORALES LOZADA JOSÉ VICENTE"
    },
    {
      "nom_par": "B",
      "materia": "FUNDAMENTOS DE PROGRAMACIÓN",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 1,
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL"
    },
    {
      "nom_par": "A",
      "materia": "FUNDAMENTOS DE PROGRAMACIÓN",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL"
    },
    {
      "nom_par": "A",
      "materia": "METODOLOGÍA DE LA INVESTIGACIÓN",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS OPERATIVOS",
      "carrera": "Software",
      "nivelNumero": 2,
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN"
    },
    {
      "nom_par": "A",
      "materia": "ESTRUCTURA DE DATOS",
      "carrera": "Software",
      "nivelNumero": 2,
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR"
    },
    {
      "nom_par": "A",
      "materia": "ESTRUCTURA DE DATOS",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 2,
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR"
    },
    {
      "nom_par": "B",
      "materia": "FUNDAMENTOS DE PROGRAMACIÓN",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 1,
      "docente": "NARANJO AVALOS HERNAN FABRICIO"
    },
    {
      "nom_par": "A",
      "materia": "ESTRUCTURA DE DATOS",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR"
    },
    {
      "nom_par": "A",
      "materia": "GESTIÓN DE PRUEBAS E IMPLANTACIÓN DE SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 6,
      "docente": "TORRES VALVERDE LEONARDO DAVID"
    },
    {
      "nom_par": "A",
      "materia": "FUNDAMENTOS DE PROGRAMACIÓN",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 2,
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO"
    },
    {
      "nom_par": "A",
      "materia": "INTRODUCCIÓN A REDES",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "URRUTIA URRUTIA ELSA PILAR"
    },
    {
      "nom_par": "A",
      "materia": "SEGURIDAD EN EL DESARROLLO DEL SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 8,
      "docente": "IBARRA TORRES OSCAR FERNANDO"
    },
    {
      "nom_par": "A",
      "materia": "ARQUITECTURA Y PLATAFORMAS DE SERVIDORES",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 3,
      "docente": "GUEVARA AULESTIA DAVID OMAR"
    },
    {
      "nom_par": "A",
      "materia": "ARQUITECTURA Y PLATAFORMAS DE SERVIDORES",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 5,
      "docente": "GUEVARA AULESTIA DAVID OMAR"
    },
    {
      "nom_par": "A",
      "materia": "SEGURIDAD DE LA INFORMACIÓN EN REDES DE COMUNICACIÓN DE DATOS",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 5,
      "docente": "GUEVARA AULESTIA DAVID OMAR"
    },
    {
      "nom_par": "A",
      "materia": "INGENIERÍA DE SOFTWARE",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 5,
      "docente": "IBARRA TORRES OSCAR FERNANDO"
    },
    {
      "nom_par": "A",
      "materia": "ADMINISTRACIÓN DE SISTEMAS OPERATIVOS",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 8,
      "docente": "GUEVARA AULESTIA DAVID OMAR"
    },
    {
      "nom_par": "A",
      "materia": "MANEJO Y CONFIGURACIÓN DEL SOFTWARE",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 4,
      "docente": "JARA MOYA SANTIAGO DAVID"
    },
    {
      "nom_par": "A",
      "materia": "FUNDAMENTOS DE REDES Y COMUNICACIÓN DE DATOS",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "URRUTIA URRUTIA ELSA PILAR"
    },
    {
      "nom_par": "A",
      "materia": "SEGURIDAD DE LA INFORMACIÓN EN REDES DE COMUNICACIÓN DE DATOS",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 4,
      "docente": "GUEVARA AULESTIA DAVID OMAR"
    },
    {
      "nom_par": "A",
      "materia": "ADMINISTRACIÓN DE SISTEMAS OPERATIVOS",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 4,
      "docente": "GUEVARA AULESTIA DAVID OMAR"
    },
    {
      "nom_par": "A",
      "materia": "APLICACIONES WEB Y MÓVILES",
      "carrera": "Software",
      "nivelNumero": 6,
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO"
    },
    {
      "nom_par": "A",
      "materia": "APLICACIONES DISTRIBUIDAS",
      "carrera": "Software",
      "nivelNumero": 6,
      "docente": "MAIGUA QUINTEROS ALEX JAVIER"
    },
    {
      "nom_par": "A",
      "materia": "DESARROLLO DE PROYECTOS",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 7,
      "docente": "URVINA BARRIONUEVO KLEVER RENATO"
    },
    {
      "nom_par": "A",
      "materia": "APLICACIONES WEB Y MÓVILES",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 7,
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO"
    },
    {
      "nom_par": "A",
      "materia": "DISEÑO DE PROYECTOS",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 7,
      "docente": "MAYORGA MAYORGA FRANKLIN OSWALDO"
    },
    {
      "nom_par": "A",
      "materia": "CONMUTACIÓN Y ENRUTAMIENTO DE REDES",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 9,
      "docente": "MANZANO VILLAFUERTE VICTOR SANTIAGO"
    },
    {
      "nom_par": "A",
      "materia": "ADMINISTRACIÓN DE REDES",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 9,
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO"
    },
    {
      "nom_par": "A",
      "materia": "EMPRENDIMIENTO Y GESTIÓN FINANCIERA",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 9,
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN"
    },
    {
      "nom_par": "A",
      "materia": "APLICACIONES DISTRIBUIDAS",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 8,
      "docente": "MAIGUA QUINTEROS ALEX JAVIER"
    },
    {
      "nom_par": "A",
      "materia": "ADMINISTRACIÓN DE REDES",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 7,
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO"
    },
    {
      "nom_par": "A",
      "materia": "DISEÑO DE PROYECTOS",
      "carrera": "Software",
      "nivelNumero": 6,
      "docente": "MAYORGA MAYORGA FRANKLIN OSWALDO"
    },
    {
      "nom_par": "A",
      "materia": "CONMUTACIÓN Y ENRUTAMIENTO DE REDES",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 7,
      "docente": "MANZANO VILLAFUERTE VICTOR SANTIAGO"
    },
    {
      "nom_par": "A",
      "materia": "DESARROLLO DE PROYECTOS",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 9,
      "docente": "URVINA BARRIONUEVO KLEVER RENATO"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS EMBEBIDOS",
      "carrera": "Robótica",
      "nivelNumero": 6,
      "docente": "GARCIA SÁNCHEZ MARCELO VLADIMIR"
    },
    {
      "nom_par": "A",
      "materia": "INSTRUMENTACIÓN INDUSTRIAL",
      "carrera": "Robótica",
      "nivelNumero": 6,
      "docente": "ESCOBAR NARANJO JUAN CAMILO"
    },
    {
      "nom_par": "A",
      "materia": "METODOLOGÍA DE LA INVESTIGACIÓN",
      "carrera": "Industrial",
      "nivelNumero": 7,
      "docente": "SEVILLA ABARCA MARTHA ESPERANZA"
    },
    {
      "nom_par": "A",
      "materia": "MÁQUINAS ELÉCTRICAS",
      "carrera": "Industrial",
      "nivelNumero": 8,
      "docente": "LOPEZ FLORES MAURICIO XAVIER"
    },
    {
      "nom_par": "B",
      "materia": "METODOLOGÍA DE LA INVESTIGACIÓN",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 1,
      "docente": "SEVILLA ABARCA MARTHA ESPERANZA"
    },
    {
      "nom_par": "B",
      "materia": "AUTOMATIZACIÓN INDUSTRIAL Y ROBÓTICA",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 1,
      "docente": "LOPEZ FLORES MAURICIO XAVIER"
    },
    {
      "nom_par": "A",
      "materia": "AUTOMATIZACIÓN INDUSTRIAL Y ROBÓTICA",
      "carrera": "Industrial",
      "nivelNumero": 4,
      "docente": "LOPEZ FLORES MAURICIO XAVIER"
    },
    {
      "nom_par": "C",
      "materia": "AUTOMATIZACIÓN INDUSTRIAL Y ROBÓTICA",
      "carrera": "Industrial",
      "nivelNumero": 4,
      "docente": "ENCALADA RUIZ PATRICIO GERMÁN"
    },
    {
      "nom_par": "B",
      "materia": "INSTRUMENTACIÓN VIRTUAL",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 1,
      "docente": "CORDOVA CORDOVA ÉDGAR PATRICIO"
    },
    {
      "nom_par": "B",
      "materia": "TECNOLOGÍAS DE LA INFORMACIÓN Y DE LA COMUNICACIÓN",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 1,
      "docente": "CARRILLO RIOS SANDRA LUCRECIA"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS EMBEBIDOS",
      "carrera": "Industrial",
      "nivelNumero": 8,
      "docente": "GARCIA SÁNCHEZ MARCELO VLADIMIR"
    },
    {
      "nom_par": "B",
      "materia": "SISTEMAS DE TELEFONÍA",
      "carrera": "Industrial",
      "nivelNumero": 8,
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO"
    },
    {
      "nom_par": "A",
      "materia": "METODOLOGÍA DE LA INVESTIGACIÓN",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 1,
      "docente": "SEVILLA ABARCA MARTHA ESPERANZA"
    },
    {
      "nom_par": "A",
      "materia": "COMUNICACIONES AVANZADAS",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 8,
      "docente": "ZAMBRANO VALVERDE TATIANA PAOLA"
    },
    {
      "nom_par": "B",
      "materia": "AUTOMATIZACIÓN INDUSTRIAL Y ROBÓTICA",
      "carrera": "Industrial",
      "nivelNumero": 8,
      "docente": "ENCALADA RUIZ PATRICIO GERMÁN"
    },
    {
      "nom_par": "B",
      "materia": "TECNOLOGÍAS DE LA INFORMACIÓN Y DE LA COMUNICACIÓN",
      "carrera": "Industrial",
      "nivelNumero": 1,
      "docente": "CARRILLO RIOS SANDRA LUCRECIA"
    },
    {
      "nom_par": "A",
      "materia": "ADMINISTRACIÓN DE LA PRODUCCIÓN",
      "carrera": "Industrial",
      "nivelNumero": 5,
      "docente": "REYES VASQUEZ JOHN PAUL"
    },
    {
      "nom_par": "A",
      "materia": "ADMINISTRACIÓN DE LA PRODUCCIÓN",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 1,
      "docente": "REYES VASQUEZ JOHN PAUL"
    },
    {
      "nom_par": "A",
      "materia": "METODOLOGÍA DE LA INVESTIGACIÓN",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 6,
      "docente": "REYES VASQUEZ JOHN PAUL"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS CAD/CAM",
      "carrera": "Industrial",
      "nivelNumero": 6,
      "docente": "LÓPEZ ARBOLEDA JESSICA PAOLA"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS CAD/CAM",
      "carrera": "Industrial",
      "nivelNumero": 8,
      "docente": "LÓPEZ ARBOLEDA JESSICA PAOLA"
    },
    {
      "nom_par": "A",
      "materia": "TECNOLOGÍAS DE LA INFORMACIÓN Y DE LA COMUNICACIÓN",
      "carrera": "Industrial",
      "nivelNumero": 5,
      "docente": "MORALES LOZADA JOSÉ VICENTE"
    },
    {
      "nom_par": "A",
      "materia": "REDES DE DATOS",
      "carrera": "Industrial",
      "nivelNumero": 2,
      "docente": "ROBALINO PEÑA EDGAR FREDDY"
    },
    {
      "nom_par": "A",
      "materia": "MÁQUINAS ELÉCTRICAS",
      "carrera": "Industrial",
      "nivelNumero": 6,
      "docente": "LOPEZ FLORES MAURICIO XAVIER"
    },
    {
      "nom_par": "A",
      "materia": "INSTRUMENTACIÓN INDUSTRIAL",
      "carrera": "Industrial",
      "nivelNumero": 1,
      "docente": "LOPEZ FLORES MAURICIO XAVIER"
    },
    {
      "nom_par": "A",
      "materia": "TECNOLOGÍAS DE LA INFORMACIÓN Y DE LA COMUNICACIÓN",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 1,
      "docente": "MORALES LOZADA JOSÉ VICENTE"
    },
    {
      "nom_par": "A",
      "materia": "MÁQUINAS ELÉCTRICAS",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 6,
      "docente": "LOPEZ FLORES MAURICIO XAVIER"
    },
    {
      "nom_par": "A",
      "materia": "SIMULACIÓN Y LABORATORIO",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 6,
      "docente": "REYES VASQUEZ JOHN PAUL"
    },
    {
      "nom_par": "B",
      "materia": "SIMULACIÓN Y LABORATORIO",
      "carrera": "Industrial",
      "nivelNumero": 4,
      "docente": "REYES VASQUEZ JOHN PAUL"
    },
    {
      "nom_par": "B",
      "materia": "SEGURIDAD INDUSTRIAL",
      "carrera": "Industrial",
      "nivelNumero": 4,
      "docente": "TIGRE ORTEGA FRANKLIN GEOVANNY"
    },
    {
      "nom_par": "B",
      "materia": "TECNOLOGÍAS DE LA INFORMACIÓN Y DE LA COMUNICACIÓN",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 1,
      "docente": "MORALES LOZADA JOSÉ VICENTE"
    },
    {
      "nom_par": "C",
      "materia": "MÁQUINAS ELÉCTRICAS",
      "carrera": "Industrial",
      "nivelNumero": 4,
      "docente": "LOPEZ FLORES MAURICIO XAVIER"
    },
    {
      "nom_par": "A",
      "materia": "SIMULACIÓN Y LABORATORIO",
      "carrera": "Industrial",
      "nivelNumero": 8,
      "docente": "REYES VASQUEZ JOHN PAUL"
    },
    {
      "nom_par": "A",
      "materia": "SOFTWARE DE SIMULACIÓN",
      "carrera": "Robótica",
      "nivelNumero": 3,
      "docente": "SALAZAR LOGROÑO FRANKLIN WILFRIDO"
    },
    {
      "nom_par": "A",
      "materia": "DISEÑO Y ORGANIZACIÓN DE PLANTAS",
      "carrera": "Robótica",
      "nivelNumero": 3,
      "docente": "NARANJO CHIRIBOGA ISRAEL ERNESTO"
    },
    {
      "nom_par": "A",
      "materia": "MÁQUINAS ELÉCTRICAS",
      "carrera": "Robótica",
      "nivelNumero": 3,
      "docente": "LOPEZ FLORES MAURICIO XAVIER"
    },
    {
      "nom_par": "A",
      "materia": "DIBUJO ASISTIDO POR COMPUTADOR",
      "carrera": "Robótica",
      "nivelNumero": 3,
      "docente": "TIGRE ORTEGA FRANKLIN GEOVANNY"
    },
    {
      "nom_par": "B",
      "materia": "METODOLOGÍA DE LA INVESTIGACIÓN",
      "carrera": "Industrial",
      "nivelNumero": 5,
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL"
    },
    {
      "nom_par": "B",
      "materia": "SOFTWARE DE SIMULACIÓN",
      "carrera": "Industrial",
      "nivelNumero": 5,
      "docente": "SALAZAR LOGROÑO FRANKLIN WILFRIDO"
    },
    {
      "nom_par": "A",
      "materia": "HIGIENE INDUSTRIAL",
      "carrera": "Industrial",
      "nivelNumero": 6,
      "docente": "MORALES PERRAZO LUIS ALBERTO"
    },
    {
      "nom_par": "A",
      "materia": "FUNDAMENTOS DE PROGRAMACIÓN",
      "carrera": "Industrial",
      "nivelNumero": 4,
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO"
    },
    {
      "nom_par": "A",
      "materia": "ADMINISTRACIÓN DE LA PRODUCCIÓN",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 1,
      "docente": "REYES VASQUEZ JOHN PAUL"
    },
    {
      "nom_par": "A",
      "materia": "DIBUJO ASISTIDO POR COMPUTADOR",
      "carrera": "Industrial",
      "nivelNumero": 6,
      "docente": "TIGRE ORTEGA FRANKLIN GEOVANNY"
    },
    {
      "nom_par": "A",
      "materia": "FUNDAMENTOS DE PROGRAMACIÓN",
      "carrera": "Industrial",
      "nivelNumero": 6,
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO"
    },
    {
      "nom_par": "A",
      "materia": "SEGURIDAD EN EL DESARROLLO DEL SOFTWARE",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 2,
      "docente": "IBARRA TORRES OSCAR FERNANDO"
    },
    {
      "nom_par": "A",
      "materia": "INSTRUMENTACIÓN INDUSTRIAL",
      "carrera": "Industrial",
      "nivelNumero": 5,
      "docente": "ENCALADA RUIZ PATRICIO GERMÁN"
    },
    {
      "nom_par": "A",
      "materia": "SOFTWARE DE SIMULACIÓN",
      "carrera": "Industrial",
      "nivelNumero": 5,
      "docente": "SALAZAR LOGROÑO FRANKLIN WILFRIDO"
    },
    {
      "nom_par": "A",
      "materia": "HIGIENE INDUSTRIAL",
      "carrera": "Industrial",
      "nivelNumero": 4,
      "docente": "MORALES PERRAZO LUIS ALBERTO"
    },
    {
      "nom_par": "A",
      "materia": "DISEÑO Y ORGANIZACIÓN DE PLANTAS",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 2,
      "docente": "NARANJO CHIRIBOGA ISRAEL ERNESTO"
    },
    {
      "nom_par": "A",
      "materia": "DISEÑO Y ORGANIZACIÓN DE PLANTAS",
      "carrera": "Software",
      "nivelNumero": 8,
      "docente": "NARANJO CHIRIBOGA ISRAEL ERNESTO"
    },
    {
      "nom_par": "A",
      "materia": "ESTADÍSTICA Y PROBABILIDAD",
      "carrera": "Industrial",
      "nivelNumero": 3,
      "docente": "ALDÁS SALAZAR DARWIN SANTIAGO"
    },
    {
      "nom_par": "A",
      "materia": "METODOLOGÍA DE LA INVESTIGACIÓN",
      "carrera": "Industrial",
      "nivelNumero": 2,
      "docente": "REYES VASQUEZ JOHN PAUL"
    },
    {
      "nom_par": "A",
      "materia": "CONTROL NEUMÁTICO E HIDRAÚLICO",
      "carrera": "Industrial",
      "nivelNumero": 8,
      "docente": "ESCOBAR NARANJO JUAN CAMILO"
    },
    {
      "nom_par": "A",
      "materia": "CONTROL NEUMÁTICO Y OLEOHIDRÁULICA",
      "carrera": "Industrial",
      "nivelNumero": 6,
      "docente": "MARIÑO RIVERA CHRISTIAN JOSÉ"
    },
    {
      "nom_par": "A",
      "materia": "CIRCUITOS RF",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 7,
      "docente": "GORDÓN GALLEGOS CARLOS DIEGO"
    },
    {
      "nom_par": "A",
      "materia": "SOFTWARE DE SIMULACIÓN",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 7,
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH"
    },
    {
      "nom_par": "B",
      "materia": "COMUNICACIÓN ANALÓGICA",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 4,
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS DIGITALES",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 8,
      "docente": "GORDÓN GALLEGOS CARLOS DIEGO"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS EMBEBIDOS (VLSI)",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 7,
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS DE CONTROL",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 7,
      "docente": "ENCALADA RUIZ PATRICIO GERMÁN"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS DIGITALES",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 4,
      "docente": "GORDÓN GALLEGOS CARLOS DIEGO"
    },
    {
      "nom_par": "B",
      "materia": "ELECTRÓNICA Y ELECTRICIDAD",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 5,
      "docente": "VARGAS GUEVARA CARLOS LUIS"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS EMBEBIDOS (VLSI)",
      "carrera": "Robótica",
      "nivelNumero": 5,
      "docente": "CORDOVA CORDOVA ÉDGAR PATRICIO"
    },
    {
      "nom_par": "A",
      "materia": "COMUNICACIONES ÓPTICAS",
      "carrera": "Robótica",
      "nivelNumero": 5,
      "docente": "GORDÓN GALLEGOS CARLOS DIEGO"
    },
    {
      "nom_par": "A",
      "materia": "SOFTWARE DE SIMULACIÓN",
      "carrera": "Robótica",
      "nivelNumero": 5,
      "docente": "GORDÓN GALLEGOS CARLOS DIEGO"
    },
    {
      "nom_par": "B",
      "materia": "SISTEMAS EMBEBIDOS (VLSI)",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 5,
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH"
    },
    {
      "nom_par": "B",
      "materia": "SOFTWARE DE SIMULACIÓN",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 4,
      "docente": "GORDÓN GALLEGOS CARLOS DIEGO"
    },
    {
      "nom_par": "A",
      "materia": "SEÑALES Y SISTEMAS",
      "carrera": "Robótica",
      "nivelNumero": 4,
      "docente": "ENCALADA RUIZ PATRICIO GERMÁN"
    },
    {
      "nom_par": "A",
      "materia": "DISPOSITIVOS Y MEDIDAS",
      "carrera": "Industrial",
      "nivelNumero": 3,
      "docente": "POMAQUERO MORENO LUIS ALFREDO"
    },
    {
      "nom_par": "A",
      "materia": "ANÁLISIS DE CIRCUITOS",
      "carrera": "Industrial",
      "nivelNumero": 3,
      "docente": "FLORES ASIMBAYA LUIS ANTONIO"
    },
    {
      "nom_par": "A",
      "materia": "CIRCUITOS ELECTRÓNICOS",
      "carrera": "Robótica",
      "nivelNumero": 2,
      "docente": "POMAQUERO MORENO LUIS ALFREDO"
    },
    {
      "nom_par": "B",
      "materia": "INSTALACIONES ELÉCTRICAS",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 4,
      "docente": "GUAMÁN MOLINA JESÚS ISRAEL"
    },
    {
      "nom_par": "A",
      "materia": "DISPOSITIVOS Y MEDIDAS",
      "carrera": "Robótica",
      "nivelNumero": 5,
      "docente": "SALAZAR LOGROÑO FRANKLIN WILFRIDO"
    },
    {
      "nom_par": "A",
      "materia": "DISPOSITIVOS Y MEDIDAS",
      "carrera": "Robótica",
      "nivelNumero": 5,
      "docente": "ROBALINO PEÑA EDGAR FREDDY"
    },
    {
      "nom_par": "A",
      "materia": "INTRODUCCIÓN A LA AUTOMATIZACIÓN",
      "carrera": "Robótica",
      "nivelNumero": 1,
      "docente": "SALAZAR LOGROÑO FRANKLIN WILFRIDO"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS EMBEBIDOS (VLSI)",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 5,
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH"
    },
    {
      "nom_par": "B",
      "materia": "SISTEMAS EMBEBIDOS (VLSI)",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 5,
      "docente": "CORDOVA CORDOVA EDGAR PATRICIO"
    },
    {
      "nom_par": "B",
      "materia": "MÁQUINAS ELÉCTRICAS",
      "carrera": "Industrial",
      "nivelNumero": 4,
      "docente": "LÓPEZ FLORES XAVIER MAURICIO"
    },
    {
      "nom_par": "C",
      "materia": "MÁQUINAS ELÉCTRICAS",
      "carrera": "Industrial",
      "nivelNumero": 4,
      "docente": "LÓPEZ FLORES XAVIER MAURICIO"
    },
    {
      "nom_par": "A",
      "materia": "MÁQUINAS ELÉCTRICAS",
      "carrera": "Robótica",
      "nivelNumero": 5,
      "docente": "GUAMÁN MOLINA JESÚS ISRAEL"
    },
    {
      "nom_par": "A",
      "materia": "PLC'S",
      "carrera": "Industrial",
      "nivelNumero": 8,
      "docente": "GARCIA SÁNCHEZ MARCELO VLADIMIR"
    },
    {
      "nom_par": "A",
      "materia": "PLC'S",
      "carrera": "Robótica",
      "nivelNumero": 6,
      "docente": "GARCIA SÁNCHEZ MARCELO VLADIMIR"
    },
    {
      "nom_par": "A",
      "materia": "INTRODUCCIÓN A REDES",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 3,
      "docente": "URRUTIA URRUTIA ELSA PILAR"
    },
    {
      "nom_par": "A",
      "materia": "CONMUTACIÓN Y ENRUTAMIENTO BÁSICO",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 7,
      "docente": "URRUTIA URRUTIA ELSA PILAR"
    },
    {
      "nom_par": "A",
      "materia": "ADMINISTRACIÓN DE REDES",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO"
    },
    {
      "nom_par": "B",
      "materia": "SISTEMAS INALÁMBRICOS",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "ROBALINO PEÑA EDGAR FREDDY"
    },
    {
      "nom_par": "A",
      "materia": "MECÁNICA BÁSICA",
      "carrera": "Robótica",
      "nivelNumero": 1,
      "docente": "CASTRO MARTIN ANA PAMELA"
    },
    {
      "nom_par": "A",
      "materia": "CÁLCULO I",
      "carrera": "Robótica",
      "nivelNumero": 1,
      "docente": "CASTRO MAYORGA MARITZA ELIZABETH"
    },
    {
      "nom_par": "A",
      "materia": "GESTIÓN AMBIENTAL",
      "carrera": "Robótica",
      "nivelNumero": 2,
      "docente": "UREÑA AGUIRRE JEANETTE DEL PILAR"
    },
    {
      "nom_par": "A",
      "materia": "FÍSICA APLICADA",
      "carrera": "Robótica",
      "nivelNumero": 2,
      "docente": "CONTRERAS ROCHA CHRISTIAN JHONNY"
    },
    {
      "nom_par": "A",
      "materia": "CÁLCULO II",
      "carrera": "Robótica",
      "nivelNumero": 2,
      "docente": "SALAZAR ESCOBAR FABIAN RODRIGO"
    },
    {
      "nom_par": "A",
      "materia": "ÁLGEBRA LINEAL",
      "carrera": "Robótica",
      "nivelNumero": 1,
      "docente": "CASTRO MAYORGA MARITZA ELIZABETH"
    },
    {
      "nom_par": "A",
      "materia": "DISPOSITIVOS Y MEDIDAS",
      "carrera": "Robótica",
      "nivelNumero": 2,
      "docente": "POMAQUERO MORENO LUIS ALFREDO"
    },
    {
      "nom_par": "A",
      "materia": "ESTÁTICA Y DINÁMICA",
      "carrera": "Robótica",
      "nivelNumero": 2,
      "docente": "CONTRERAS ROCHA CHRISTIAN JHONNY"
    },
    {
      "nom_par": "A",
      "materia": "MÉTODOS NUMÉRICOS",
      "carrera": "Robótica",
      "nivelNumero": 3,
      "docente": "CONTRERAS ROCHA CHRISTIAN JHONNY"
    },
    {
      "nom_par": "A",
      "materia": "ECUACIONES DIFERENCIALES",
      "carrera": "Robótica",
      "nivelNumero": 3,
      "docente": "GUILCAPI MOSQUERA JAIME RODRIGO"
    },
    {
      "nom_par": "A",
      "materia": "INSTALACIONES ELÉCTRICAS",
      "carrera": "Robótica",
      "nivelNumero": 4,
      "docente": "GUAMÁN MOLINA JESUS ISRAEL"
    },
    {
      "nom_par": "A",
      "materia": "TEORÍA ELECTROMAGNÉTICA",
      "carrera": "Robótica",
      "nivelNumero": 4,
      "docente": "POMAQUERO MORENO LUIS ALFREDO"
    },
    {
      "nom_par": "A",
      "materia": "MECANISMOS",
      "carrera": "Robótica",
      "nivelNumero": 4,
      "docente": "ESCOBAR NARANJO JUAN CAMILO"
    },
    {
      "nom_par": "A",
      "materia": "PROBABILIDAD Y ESTADÍSTICA",
      "carrera": "Robótica",
      "nivelNumero": 3,
      "docente": "GUILCAPI MOSQUERA JAIME RODRIGO"
    },
    {
      "nom_par": "A",
      "materia": "CIRCUITOS ELÉCTRICOS",
      "carrera": "Robótica",
      "nivelNumero": 3,
      "docente": "GUAMÁN MOLINA JESUS ISRAEL"
    },
    {
      "nom_par": "A",
      "materia": "GESTIÓN DE CALIDAD",
      "carrera": "Robótica",
      "nivelNumero": 4,
      "docente": "UREÑA AGUIRRE JEANETTE DEL PILAR"
    },
    {
      "nom_par": "A",
      "materia": "SEGURIDAD INDUSTRIAL",
      "carrera": "Robótica",
      "nivelNumero": 3,
      "docente": "UREÑA AGUIRRE JEANETTE DEL PILAR"
    },
    {
      "nom_par": "B",
      "materia": "CÁLCULO DE UNA VARIABLE",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 1,
      "docente": "SALAZAR ESCOBAR FABIAN RODRIGO"
    },
    {
      "nom_par": "B",
      "materia": "ÁLGEBRA LINEAL",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 1,
      "docente": "ZAMBRANO VALVERDE TATIANA PAOLA"
    },
    {
      "nom_par": "B",
      "materia": "EVOLUCIÓN DE LAS TELECOMUNICACIONES",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 1,
      "docente": "FLORES ASIMBAYA LUIS ANTONIO"
    },
    {
      "nom_par": "A",
      "materia": "CÁLCULO DE VARIAS VARIABLES",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 2,
      "docente": "ZAMBRANO VALVERDE TATIANA PAOLA"
    },
    {
      "nom_par": "B",
      "materia": "FÍSICA BÁSICA",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 1,
      "docente": "CONTRERAS ROCHA CHRISTIAN JHONNY"
    },
    {
      "nom_par": "A",
      "materia": "FÍSICA APLICADA",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 2,
      "docente": "BENALCAZAR PALACIOS FREDDY GEOVANNY"
    },
    {
      "nom_par": "A",
      "materia": "EVOLUCIÓN DE LAS TELECOMUNICACIONES",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 2,
      "docente": "FLORES ASIMBAYA LUIS ANTONIO"
    },
    {
      "nom_par": "B",
      "materia": "QUÍMICA",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 1,
      "docente": "SEVILLA ABARCA MARTHA ESPERANZA"
    },
    {
      "nom_par": "A",
      "materia": "GESTIÓN DE CALIDAD",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 2,
      "docente": "SEVILLA ABARCA MARTHA ESPERANZA"
    },
    {
      "nom_par": "A",
      "materia": "INVESTIGACIÓN OPERATIVA",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR"
    },
    {
      "nom_par": "A",
      "materia": "PROCESAMIENTO DIGITAL DE SEÑALES",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "ALTAMIRANO MELÉNDEZ SANTIAGO MAURICIO"
    },
    {
      "nom_par": "A",
      "materia": "COMUNICACIÓN ANALÓGICA",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH"
    },
    {
      "nom_par": "A",
      "materia": "LÍNEAS DE TRANSMISIÓN",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 5,
      "docente": "CUJI RODRIGUEZ JULIO ENRIQUE"
    },
    {
      "nom_par": "A",
      "materia": "PROCESAMIENTO DIGITAL DE SEÑALES",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 6,
      "docente": "ALTAMIRANO MELÉNDEZ SANTIAGO MAURICIO"
    },
    {
      "nom_par": "A",
      "materia": "PROPAGACIÓN Y ANTENAS",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 7,
      "docente": "CUJI RODRIGUEZ JULIO ENRIQUE"
    },
    {
      "nom_par": "A",
      "materia": "PROYECTOS DE TELECOMUNICACIONES",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 6,
      "docente": "ZAMBRANO VALVERDE TATIANA PAOLA"
    },
    {
      "nom_par": "A",
      "materia": "COMUNICACIÓN DIGITAL",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 7,
      "docente": "FLORES ASIMBAYA LUIS ANTONIO"
    },
    {
      "nom_par": "A",
      "materia": "PROYECTOS DE TELECOMUNICACIONES",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 7,
      "docente": "ZAMBRANO VALVERDE TATIANA PAOLA"
    },
    {
      "nom_par": "A",
      "materia": "LÍNEAS DE TRANSMISIÓN",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 6,
      "docente": "CUJI RODRIGUEZ JULIO ENRIQUE"
    },
    {
      "nom_par": "B",
      "materia": "INVESTIGACIÓN OPERATIVA",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS DE TELEFONÍA",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 6,
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO"
    },
    {
      "nom_par": "A",
      "materia": "COMUNICACIÓN ANALÓGICA",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 6,
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH"
    },
    {
      "nom_par": "A",
      "materia": "CIRCUITOS ELECTRÓNICOS",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 5,
      "docente": "GARCIA CARRILLO MARIO GEOVANNI"
    },
    {
      "nom_par": "A",
      "materia": "CIRCUITOS ELECTRÓNICOS",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 5,
      "docente": "GARCIA CARRILLO MARIO GEOVANNI"
    },
    {
      "nom_par": "A",
      "materia": "REALIDAD NACIONAL",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 5,
      "docente": "ALTAMIRANO MELÉNDEZ SANTIAGO MAURICIO"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS INALÁMBRICOS",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 8,
      "docente": "ROBALINO PEÑA EDGAR FREDDY"
    },
    {
      "nom_par": "A",
      "materia": "DISEÑO DE PROYECTOS",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 8,
      "docente": "CASTRO MARTIN ANA PAMELA"
    },
    {
      "nom_par": "A",
      "materia": "COMUNICACIONES MÓVILES",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 8,
      "docente": "CORDOVA CORDOVA EDGAR PATRICIO"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS EMBEBIDOS (VLSI)",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 5,
      "docente": "CORDOVA CORDOVA EDGAR PATRICIO"
    },
    {
      "nom_par": "A",
      "materia": "PROCESOS ESTOCASTICOS",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 5,
      "docente": "CASTRO MARTIN ANA PAMELA"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS SATELITALES Y GPS",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 8,
      "docente": "FLORES ASIMBAYA LUIS ANTONIO"
    },
    {
      "nom_par": "A",
      "materia": "TELEVISIÓN DIGITAL",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 8,
      "docente": "ALTAMIRANO MELÉNDEZ SANTIAGO MAURICIO"
    },
    {
      "nom_par": "A",
      "materia": "COMUNICACIONES MÓVILES",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 8,
      "docente": "CORDOVA CORDOVA EDGAR PATRICIO"
    },
    {
      "nom_par": "A",
      "materia": "FÍSICA PARA ELECTRÓNICA",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 3,
      "docente": "BENALCAZAR PALACIOS FREDDY GEOVANNY"
    },
    {
      "nom_par": "A",
      "materia": "PROBABILIDAD Y ESTADÍSTICA",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 3,
      "docente": "GUILCAPI MOSQUERA JAIME RODRIGO"
    },
    {
      "nom_par": "A",
      "materia": "ANÁLISIS DE CIRCUITOS",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 4,
      "docente": "GARCIA CARRILLO MARIO GEOVANNI"
    },
    {
      "nom_par": "A",
      "materia": "MÉTODOS NUMÉRICOS",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 3,
      "docente": "SÁNCHEZ BENÍTEZ CLARA AUGUSTA"
    },
    {
      "nom_par": "A",
      "materia": "DISPOSITIVOS Y MEDIDAS",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 3,
      "docente": "ROBALINO PEÑA EDGAR FREDDY"
    },
    {
      "nom_par": "A",
      "materia": "ECUACIONES DIFERENCIALES",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 3,
      "docente": "GUILCAPI MOSQUERA JAIME RODRIGO"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS LINEALES",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 3,
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH"
    },
    {
      "nom_par": "A",
      "materia": "FÍSICA PARA ELECTRÓNICA",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 3,
      "docente": "BENALCAZAR PALACIOS FREDDY GEOVANNY"
    },
    {
      "nom_par": "B",
      "materia": "ÁLGEBRA LINEAL",
      "carrera": "Industrial",
      "nivelNumero": 2,
      "docente": "MORALES OÑATE BOLÍVAR EFRAÍN"
    },
    {
      "nom_par": "B",
      "materia": "FÍSICA APLICADA",
      "carrera": "Industrial",
      "nivelNumero": 2,
      "docente": "URRUTIA URRUTIA FERNANDO"
    },
    {
      "nom_par": "A",
      "materia": "ERGONOMÍA",
      "carrera": "Industrial",
      "nivelNumero": 3,
      "docente": "URRUTIA URRUTIA FERNANDO"
    },
    {
      "nom_par": "A",
      "materia": "MÁQUINAS HERRAMIENTAS",
      "carrera": "Industrial",
      "nivelNumero": 3,
      "docente": "MARIÑO RIVERA CHRISTIAN JOSÉ"
    },
    {
      "nom_par": "A",
      "materia": "ADMINISTRACIÓN DE LA PRODUCCIÓN",
      "carrera": "Industrial",
      "nivelNumero": 3,
      "docente": "REYES VASQUEZ JOHN PAUL"
    },
    {
      "nom_par": "A",
      "materia": "OPERACIONES UNITARIAS",
      "carrera": "Industrial",
      "nivelNumero": 4,
      "docente": "ORTIZ GUERRERO DAYSI MARGARITA"
    },
    {
      "nom_par": "A",
      "materia": "SEGURIDAD INDUSTRIAL",
      "carrera": "Industrial",
      "nivelNumero": 4,
      "docente": "TIGRE ORTEGA FRANKLIN GEOVANNY"
    },
    {
      "nom_par": "A",
      "materia": "ELECTRÓNICA Y ELECTRICIDAD",
      "carrera": "Industrial",
      "nivelNumero": 5,
      "docente": "VARGAS GUEVARA CARLOS LUIS"
    },
    {
      "nom_par": "A",
      "materia": "INVESTIGACIÓN DE OPERACIONES",
      "carrera": "Industrial",
      "nivelNumero": 5,
      "docente": "NARANJO CHIRIBOGA ISRAEL ERNESTO"
    },
    {
      "nom_par": "A",
      "materia": "TERMODINÁMICA",
      "carrera": "Industrial",
      "nivelNumero": 5,
      "docente": "LEMA CHICAIZA FREDDY ROBERTO"
    },
    {
      "nom_par": "A",
      "materia": "INGENIERÍA DE MÉTODOS",
      "carrera": "Industrial",
      "nivelNumero": 4,
      "docente": "SÁNCHEZ ROSERO CARLOS HUMBERTO"
    },
    {
      "nom_par": "A",
      "materia": "CONTABILIDAD Y COSTOS INDUSTRIALES",
      "carrera": "Industrial",
      "nivelNumero": 4,
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA"
    },
    {
      "nom_par": "A",
      "materia": "INVESTIGACIÓN DE OPERACIONES",
      "carrera": "Industrial",
      "nivelNumero": 3,
      "docente": "NARANJO CHIRIBOGA ISRAEL ERNESTO"
    },
    {
      "nom_par": "A",
      "materia": "CÁLCULO INTEGRAL",
      "carrera": "Industrial",
      "nivelNumero": 3,
      "docente": "MORALES OÑATE BOLÍVAR EFRAÍN"
    },
    {
      "nom_par": "A",
      "materia": "TECNOLOGÍA DE LOS MATERIALES",
      "carrera": "Industrial",
      "nivelNumero": 3,
      "docente": "MARIÑO RIVERA CHRISTIAN JOSÉ"
    },
    {
      "nom_par": "B",
      "materia": "TECNOLOGÍA DE LOS MATERIALES",
      "carrera": "Industrial",
      "nivelNumero": 3,
      "docente": "MARIÑO RIVERA CHRISTIAN JOSÉ"
    },
    {
      "nom_par": "A",
      "materia": "INGENIERÍA DE MÉTODOS",
      "carrera": "Industrial",
      "nivelNumero": 4,
      "docente": "SÁNCHEZ ROSERO CARLOS HUMBERTO"
    },
    {
      "nom_par": "B",
      "materia": "INGENIERÍA DE MÉTODOS",
      "carrera": "Industrial",
      "nivelNumero": 4,
      "docente": "SÁNCHEZ ROSERO CARLOS HUMBERTO"
    },
    {
      "nom_par": "A",
      "materia": "DISEÑO DE PROYECTOS",
      "carrera": "Industrial",
      "nivelNumero": 8,
      "docente": "ORTIZ GUERRERO DAYSI MARGARITA"
    },
    {
      "nom_par": "A",
      "materia": "LOGÍSTICA Y CADENA DE ABASTECIMIENTO",
      "carrera": "Industrial",
      "nivelNumero": 8,
      "docente": "NARANJO CHIRIBOGA ISRAEL ERNESTO"
    },
    {
      "nom_par": "A",
      "materia": "EMPRENDIMIENTO E INNOVACIÓN",
      "carrera": "Industrial",
      "nivelNumero": 7,
      "docente": "LÓPEZ ARBOLEDA JESSICA PAOLA"
    },
    {
      "nom_par": "A",
      "materia": "CONTROL DE CALIDAD",
      "carrera": "Industrial",
      "nivelNumero": 7,
      "docente": "ALDÁS SALAZAR DARWIN SANTIAGO"
    },
    {
      "nom_par": "A",
      "materia": "GERENCIA EMPRESARIAL",
      "carrera": "Industrial",
      "nivelNumero": 7,
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA"
    },
    {
      "nom_par": "A",
      "materia": "GESTIÓN DEL MANTENIMIENTO",
      "carrera": "Industrial",
      "nivelNumero": 7,
      "docente": "URRUTIA URRUTIA FERNANDO"
    },
    {
      "nom_par": "A",
      "materia": "GESTIÓN DE CALIDAD",
      "carrera": "Industrial",
      "nivelNumero": 7,
      "docente": "MARIÑO RIVERA CHRISTIAN JOSÉ"
    },
    {
      "nom_par": "A",
      "materia": "DISEÑO DE PROYECTOS",
      "carrera": "Industrial",
      "nivelNumero": 7,
      "docente": "ORTIZ GUERRERO DAYSI MARGARITA"
    },
    {
      "nom_par": "B",
      "materia": "LÓGICA MATEMÁTICA",
      "carrera": "Software",
      "nivelNumero": 1,
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO"
    },
    {
      "nom_par": "B",
      "materia": "FÍSICA",
      "carrera": "Software",
      "nivelNumero": 1,
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO"
    },
    {
      "nom_par": "B",
      "materia": "ELECTROMAGNETISMO",
      "carrera": "Software",
      "nivelNumero": 1,
      "docente": "CUJI RODRIGUEZ JULIO ENRIQUE"
    },
    {
      "nom_par": "B",
      "materia": "ANÁLISIS DE CIRCUITOS",
      "carrera": "Software",
      "nivelNumero": 1,
      "docente": "FLORES ASIMBAYA LUIS ANTONIO"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS LINEALES",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 4,
      "docente": "GARCIA CARRILLO MARIO GEOVANNI"
    },
    {
      "nom_par": "B",
      "materia": "CÁLCULO DIFERENCIAL",
      "carrera": "Software",
      "nivelNumero": 1,
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN"
    },
    {
      "nom_par": "B",
      "materia": "SISTEMAS LINEALES",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 4,
      "docente": "GARCIA CARRILLO MARIO GEOVANNI"
    },
    {
      "nom_par": "B",
      "materia": "ELECTROMAGNETISMO",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 4,
      "docente": "CUJI RODRIGUEZ JULIO ENRIQUE"
    },
    {
      "nom_par": "B",
      "materia": "ÁLGEBRA LINEAL",
      "carrera": "Software",
      "nivelNumero": 1,
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR"
    },
    {
      "nom_par": "A",
      "materia": "ANÁLISIS DE CIRCUITOS",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 4,
      "docente": "FLORES ASIMBAYA LUIS ANTONIO"
    },
    {
      "nom_par": "A",
      "materia": "FÍSICA",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 1,
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO"
    },
    {
      "nom_par": "A",
      "materia": "INGENIERÍA DE MÉTODOS",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 4,
      "docente": "SÁNCHEZ ROSERO CARLOS HUMBERTO"
    },
    {
      "nom_par": "B",
      "materia": "DESARROLLO DE PROYECTOS",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 3,
      "docente": "LÓPEZ ARBOLEDA JESSICA PAOLA"
    },
    {
      "nom_par": "B",
      "materia": "INGENIERÍA DE MÉTODOS",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 3,
      "docente": "SÁNCHEZ ROSERO CARLOS HUMBERTO"
    },
    {
      "nom_par": "B",
      "materia": "MÉTODOS NUMÉRICOS",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 3,
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO"
    },
    {
      "nom_par": "A",
      "materia": "DESARROLLO DE PROYECTOS",
      "carrera": "Industrial",
      "nivelNumero": 9,
      "docente": "LÓPEZ ARBOLEDA JESSICA PAOLA"
    },
    {
      "nom_par": "A",
      "materia": "FÍSICA BÁSICA",
      "carrera": "Industrial",
      "nivelNumero": 1,
      "docente": "VARGAS GUEVARA CARLOS LUIS"
    },
    {
      "nom_par": "A",
      "materia": "QUÍMICA",
      "carrera": "Industrial",
      "nivelNumero": 1,
      "docente": "LEMA CHICAIZA FREDDY ROBERTO"
    },
    {
      "nom_par": "A",
      "materia": "INTRODUCCIÓN A LA INGENIERÍA INDUSTRIAL",
      "carrera": "Industrial",
      "nivelNumero": 1,
      "docente": "SÁNCHEZ ROSERO CARLOS HUMBERTO"
    },
    {
      "nom_par": "A",
      "materia": "LÓGICA MATEMÁTICA",
      "carrera": "Industrial",
      "nivelNumero": 1,
      "docente": "CARRILLO RIOS SANDRA LUCRECIA"
    },
    {
      "nom_par": "A",
      "materia": "GESTIÓN POR PROCESOS",
      "carrera": "Industrial",
      "nivelNumero": 1,
      "docente": "ORTIZ GUERRERO DAYSI MARGARITA"
    },
    {
      "nom_par": "A",
      "materia": "CONTROL NEUMÁTICO Y OLEOHIDRÁULICA",
      "carrera": "Industrial",
      "nivelNumero": 1,
      "docente": "MARIÑO RIVERA CHRISTIAN JOSÉ"
    },
    {
      "nom_par": "A",
      "materia": "GESTIÓN AMBIENTAL Y ENERGÍAS ALTERNATIVAS",
      "carrera": "Industrial",
      "nivelNumero": 1,
      "docente": "UREÑA AGUIRRE JEANETTE DEL PILAR"
    },
    {
      "nom_par": "A",
      "materia": "ÁLGEBRA",
      "carrera": "Industrial",
      "nivelNumero": 1,
      "docente": "TUBÓN NUÑEZ EDITH ELENA"
    },
    {
      "nom_par": "A",
      "materia": "GESTIÓN AMBIENTAL Y ENERGÍAS ALTERNATIVAS",
      "carrera": "Industrial",
      "nivelNumero": 6,
      "docente": "UREÑA AGUIRRE JEANETTE DEL PILAR"
    },
    {
      "nom_par": "A",
      "materia": "ESTADÍSTICA Y PROBABILIDAD",
      "carrera": "Industrial",
      "nivelNumero": 5,
      "docente": "ALDÁS SALAZAR DARWIN SANTIAGO"
    },
    {
      "nom_par": "A",
      "materia": "ESTADÍSTICA Y PROBABILIDAD",
      "carrera": "Industrial",
      "nivelNumero": 5,
      "docente": "ALDÁS SALAZAR DARWIN SANTIAGO"
    },
    {
      "nom_par": "A",
      "materia": "CÁLCULO INTEGRAL",
      "carrera": "Industrial",
      "nivelNumero": 5,
      "docente": "MORALES OÑATE BOLÍVAR EFRAÍN"
    },
    {
      "nom_par": "A",
      "materia": "CÁLCULO DIFERENCIAL",
      "carrera": "Industrial",
      "nivelNumero": 2,
      "docente": "TUBÓN NUÑEZ EDITH ELENA"
    },
    {
      "nom_par": "A",
      "materia": "ÁLGEBRA LINEAL",
      "carrera": "Industrial",
      "nivelNumero": 2,
      "docente": "MORALES OÑATE BOLÍVAR EFRAÍN"
    },
    {
      "nom_par": "A",
      "materia": "GESTIÓN DE OPERACIONES",
      "carrera": "Industrial",
      "nivelNumero": 3,
      "docente": "ROSERO MANTILLA CESAR ANIBAL"
    },
    {
      "nom_par": "A",
      "materia": "PROCESOS INDUSTRIALES",
      "carrera": "Industrial",
      "nivelNumero": 3,
      "docente": "NARANJO CHIRIBOGA ISRAEL ERNESTO"
    },
    {
      "nom_par": "A",
      "materia": "FÍSICA APLICADA",
      "carrera": "Industrial",
      "nivelNumero": 2,
      "docente": "URRUTIA URRUTIA FERNANDO"
    },
    {
      "nom_par": "A",
      "materia": "MÁQUINAS HERRAMIENTAS",
      "carrera": "Industrial",
      "nivelNumero": 5,
      "docente": "MARIÑO RIVERA CHRISTIAN JOSÉ"
    },
    {
      "nom_par": "A",
      "materia": "REALIDAD NACIONAL",
      "carrera": "Industrial",
      "nivelNumero": 2,
      "docente": "CARRILLO RIOS SANDRA LUCRECIA"
    },
    {
      "nom_par": "A",
      "materia": "GESTIÓN DE OPERACIONES",
      "carrera": "Industrial",
      "nivelNumero": 5,
      "docente": "ROSERO MANTILLA CESAR ANIBAL"
    },
    {
      "nom_par": "B",
      "materia": "GESTIÓN DE CALIDAD",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 2,
      "docente": "MARIÑO RIVERA CHRISTIAN JOSÉ"
    },
    {
      "nom_par": "B",
      "materia": "EMPRENDIMIENTO Y LEGISLACIÓN LABORAL",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 2,
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA"
    },
    {
      "nom_par": "B",
      "materia": "CÁLCULO INTEGRAL",
      "carrera": "Industrial",
      "nivelNumero": 3,
      "docente": "MORALES OÑATE BOLÍVAR EFRAÍN"
    },
    {
      "nom_par": "B",
      "materia": "ELECTRÓNICA Y ELECTRICIDAD",
      "carrera": "Industrial",
      "nivelNumero": 3,
      "docente": "VARGAS GUEVARA CARLOS LUIS"
    },
    {
      "nom_par": "A",
      "materia": "GESTIÓN DE CALIDAD",
      "carrera": "Industrial",
      "nivelNumero": 8,
      "docente": "UREÑA AGUIRRE JEANETTE DEL PILAR"
    },
    {
      "nom_par": "A",
      "materia": "EMPRENDIMIENTO Y LEGISLACIÓN LABORAL",
      "carrera": "Software",
      "nivelNumero": 8,
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA"
    },
    {
      "nom_par": "B",
      "materia": "INVESTIGACIÓN DE OPERACIONES",
      "carrera": "Industrial",
      "nivelNumero": 3,
      "docente": "ORTIZ GUERRERO DAYSI MARGARITA"
    },
    {
      "nom_par": "B",
      "materia": "FÍSICA APLICADA",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 2,
      "docente": "BENALCAZAR PALACIOS FREDDY GEOVANNY"
    },
    {
      "nom_par": "B",
      "materia": "GESTIÓN DE CALIDAD",
      "carrera": "Telecomunicaciones",
      "nivelNumero": 2,
      "docente": "UREÑA AGUIRRE JEANETTE DEL PILAR"
    },
    {
      "nom_par": "A",
      "materia": "REALIDAD NACIONAL",
      "carrera": "Software",
      "nivelNumero": 6,
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA"
    },
    {
      "nom_par": "A",
      "materia": "FÍSICA",
      "carrera": "Software",
      "nivelNumero": 1,
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO"
    },
    {
      "nom_par": "A",
      "materia": "ÁLGEBRA LINEAL",
      "carrera": "Software",
      "nivelNumero": 1,
      "docente": "REYES BEDOYA DONALD EDUARDO"
    },
    {
      "nom_par": "A",
      "materia": "ÁLGEBRA LINEAL",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 1,
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN"
    },
    {
      "nom_par": "A",
      "materia": "CÁLCULO INTEGRAL",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 1,
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO"
    },
    {
      "nom_par": "B",
      "materia": "CÁLCULO INTEGRAL",
      "carrera": "Software",
      "nivelNumero": 2,
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO"
    },
    {
      "nom_par": "A",
      "materia": "LÓGICA MATEMÁTICA",
      "carrera": "Software",
      "nivelNumero": 1,
      "docente": "TORRES ABRIL PAULO CESAR"
    },
    {
      "nom_par": "A",
      "materia": "CÁLCULO DIFERENCIAL",
      "carrera": "Software",
      "nivelNumero": 1,
      "docente": "CASTRO MAYORGA MARITZA ELIZABETH"
    },
    {
      "nom_par": "A",
      "materia": "PROBABILIDAD Y ESTADÍSTICA",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "REYES BEDOYA DONALD EDUARDO"
    },
    {
      "nom_par": "A",
      "materia": "MÉTODOS NUMÉRICOS",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN"
    },
    {
      "nom_par": "A",
      "materia": "REALIDAD NACIONAL",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "MORALES LOZADA JOSE VICENTE"
    },
    {
      "nom_par": "A",
      "materia": "PROBABILIDAD Y ESTADÍSTICA",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 3,
      "docente": "REYES BEDOYA DONALD EDUARDO"
    },
    {
      "nom_par": "A",
      "materia": "PROBABILIDAD Y ESTADÍSTICA",
      "carrera": "Software",
      "nivelNumero": 1,
      "docente": "REYES BEDOYA DONALD EDUARDO"
    },
    {
      "nom_par": "A",
      "materia": "MEDIDAS ELÉCTRICAS",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 2,
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO"
    },
    {
      "nom_par": "B",
      "materia": "PROBABILIDAD Y ESTADÍSTICA",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "ALDÁS SALAZAR DARWIN SANTIAGO"
    },
    {
      "nom_par": "A",
      "materia": "CÁLCULO INTEGRAL",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 2,
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR"
    },
    {
      "nom_par": "A",
      "materia": "LÓGICA MATEMÁTICA",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 2,
      "docente": "TORRES ABRIL PAULO CESAR"
    },
    {
      "nom_par": "B",
      "materia": "MÉTODOS NUMÉRICOS",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 1,
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO"
    },
    {
      "nom_par": "B",
      "materia": "CÁLCULO DIFERENCIAL",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 1,
      "docente": "CASTRO MAYORGA MARITZA ELIZABETH"
    },
    {
      "nom_par": "A",
      "materia": "CÁLCULO DIFERENCIAL",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 1,
      "docente": "CASTRO MAYORGA MARITZA ELIZABETH"
    },
    {
      "nom_par": "A",
      "materia": "ÁLGEBRA LINEAL",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 1,
      "docente": "REYES BEDOYA DONALD EDUARDO"
    },
    {
      "nom_par": "B",
      "materia": "CÁLCULO DIFERENCIAL",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "CASTRO MAYORGA MARITZA ELIZABETH"
    },
    {
      "nom_par": "B",
      "materia": "CÁLCULO INTEGRAL",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 1,
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO"
    },
    {
      "nom_par": "A",
      "materia": "CÁLCULO INTEGRAL",
      "carrera": "Software",
      "nivelNumero": 2,
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO"
    },
    {
      "nom_par": "A",
      "materia": "FÍSICA",
      "carrera": "Software",
      "nivelNumero": 1,
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN"
    },
    {
      "nom_par": "B",
      "materia": "FÍSICA",
      "carrera": "Tecnologías de la Información",
      "nivelNumero": 1,
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN"
    },
    {
      "nom_par": "B",
      "materia": "MÉTODOS NUMÉRICOS",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO"
    }
  ],
  "horarios": [
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "MODELAMIENTO Y DISEÑO DE SOFTWARE - 3B SW",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "LUNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "MODELAMIENTO Y DISEÑO DE SOFTWARE - 3B SW",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "LUNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "ESTRUCTURA DE DATOS - 3B SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "LUNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "ESTRUCTURA DE DATOS - 3B SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "LUNES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "ESTRUCTURA DE DATOS - 3B SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "LUNES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "INTELIGENCIA DE NEGOCIOS - 6A SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
      "dia_semana": "LUNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "INTELIGENCIA DE NEGOCIOS - 6A SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
      "dia_semana": "LUNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "PROGRAMACIÓN ORIENTADA A OBJETOS - 2B SW",
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN",
      "dia_semana": "LUNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "PROGRAMACIÓN ORIENTADA A OBJETOS - 2B SW",
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN",
      "dia_semana": "LUNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "REDES - 4A SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "LUNES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "REDES - 4A SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "LUNES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "INTRODUCCIÓN A REDES - 3A TI",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "INTRODUCCIÓN A REDES - 3A TI",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "MODELAMIENTO Y DISEÑO DE SOFTWARE - 3B SW",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "MODELAMIENTO Y DISEÑO DE SOFTWARE - 3B SW",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "MIERCOLES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "PROGRAMACIÓN - 8A SW",
      "docente": "RUIZ BANDA JAIME BOLIVAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "PROGRAMACIÓN - 8A SW",
      "docente": "RUIZ BANDA JAIME BOLIVAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "INTELIGENCIA DE NEGOCIOS - 6A SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "INTELIGENCIA DE NEGOCIOS - 6A SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "PROGRAMACIÓN - 2B II",
      "docente": "RUIZ BANDA JAIME BOLIVAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "PROGRAMACIÓN - 2B II",
      "docente": "RUIZ BANDA JAIME BOLIVAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "SISTEMAS OPERATIVOS - 3A TI",
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN",
      "dia_semana": "JUEVES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "SISTEMAS OPERATIVOS - 3B SW",
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN",
      "dia_semana": "JUEVES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "INTRODUCCIÓN A REDES - 3B SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "JUEVES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "INTRODUCCIÓN A REDES - 3B SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "JUEVES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "INGENIERÍA ECONÓMICA PARA SOFTWARE - 8A SW",
      "docente": "JARA MOYA SANTIAGO DAVID",
      "dia_semana": "JUEVES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "INGENIERÍA ECONÓMICA PARA SOFTWARE - 8A SW",
      "docente": "JARA MOYA SANTIAGO DAVID",
      "dia_semana": "JUEVES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "REDES - 4A SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "JUEVES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "REDES - 4A SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "JUEVES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "SISTEMAS OPERATIVOS - 2B SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "JUEVES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "SISTEMAS OPERATIVOS - 2B SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "JUEVES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "PROGRAMACIÓN AVANZADA - 3A TI",
      "docente": "NARANJO AVALOS HERNAN FABRICIO",
      "dia_semana": "VIERNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN - 1B SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "VIERNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN - 1B SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "VIERNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "PROGRAMACIÓN ORIENTADA A OBJETOS - 2B SW",
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN",
      "dia_semana": "VIERNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "PROGRAMACIÓN ORIENTADA A OBJETOS - 2B SW",
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN",
      "dia_semana": "VIERNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "PROGRAMACIÓN ORIENTADA A OBJETOS - 2B SW",
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN",
      "dia_semana": "VIERNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "PROGRAMACIÓN - 2A II",
      "docente": "RUIZ BANDA JAIME BOLIVAR",
      "dia_semana": "VIERNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "PROGRAMACIÓN - 2A II",
      "docente": "RUIZ BANDA JAIME BOLIVAR",
      "dia_semana": "VIERNES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "APLICACIONES ORIENTADAS A SERVICIOS - 5A SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "LUNES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "APLICACIONES ORIENTADAS A SERVICIOS - 5A SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "LUNES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "COMPUTACIÓN VISUAL - 4B SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "LUNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "COMPUTACIÓN VISUAL - 4B SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "LUNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "PROGRAMACIÓN ORIENTADA A OBJETOS - 4B SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "LUNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "PROGRAMACIÓN ORIENTADA A OBJETOS - 4B SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "LUNES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "REDES - 4B SW",
      "docente": "CHANGO SAILEMA WILSON GUSTAVO",
      "dia_semana": "LUNES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "REDES - 4B SW",
      "docente": "CHANGO SAILEMA WILSON GUSTAVO",
      "dia_semana": "LUNES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "APLICACIONES ORIENTADAS A SERVICIOS - 3A IT",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "MARTES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "APLICACIONES ORIENTADAS A SERVICIOS - 3A IT",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "MARTES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN - 3A IT",
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL",
      "dia_semana": "MARTES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN - 3A IT",
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL",
      "dia_semana": "MARTES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "COMPUTACIÓN VISUAL - 3A IT",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "MARTES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "COMPUTACIÓN VISUAL - 3A IT",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "MARTES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "COMPUTACIÓN VISUAL - 2A TI",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "MARTES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "REDES - 2A TI",
      "docente": "CHANGO SAILEMA WILSON GUSTAVO",
      "dia_semana": "MARTES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "REDES - 2A TI",
      "docente": "CHANGO SAILEMA WILSON GUSTAVO",
      "dia_semana": "MARTES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN - 1A SW",
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN - 1A SW",
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL",
      "dia_semana": "MIERCOLES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "COMPUTACIÓN VISUAL - 4A SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "MIERCOLES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "COMPUTACIÓN VISUAL - 4A SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "COMPUTACIÓN VISUAL - 4A SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "MIERCOLES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "SISTEMAS OPERATIVOS - 4A SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "SISTEMAS OPERATIVOS - 4B SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "SISTEMAS OPERATIVOS - 4B SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "ESTRUCTURA DE DATOS - 3B SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "JUEVES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN - 1A SW",
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL",
      "dia_semana": "JUEVES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN - 1A SW",
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL",
      "dia_semana": "JUEVES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN - 1B SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "JUEVES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN - 1B SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "JUEVES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "COMPUTACIÓN VISUAL - 4A SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "JUEVES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "COMPUTACIÓN VISUAL - 4A SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "JUEVES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "BASE DE DATOS - 4B SW",
      "docente": "MORALES LOZADA JOSÉ VICENTE",
      "dia_semana": "JUEVES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "PROGRAMACIÓN ORIENTADA A OBJETOS - 2B SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "JUEVES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "PROGRAMACIÓN ORIENTADA A OBJETOS - 2B SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "JUEVES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "PROGRAMACIÓN ORIENTADA A OBJETOS - 2B SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "JUEVES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "APLICACIONES ORIENTADAS A SERVICIOS - 5A SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "VIERNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "APLICACIONES ORIENTADAS A SERVICIOS - 5A SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "VIERNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "REDES - 4B SW",
      "docente": "CHANGO SAILEMA WILSON GUSTAVO",
      "dia_semana": "VIERNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "REDES - 4B SW",
      "docente": "CHANGO SAILEMA WILSON GUSTAVO",
      "dia_semana": "VIERNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "BASE DE DATOS - 2A IT",
      "docente": "MORALES LOZADA JOSÉ VICENTE",
      "dia_semana": "VIERNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "BASE DE DATOS - 2A IT",
      "docente": "MORALES LOZADA JOSÉ VICENTE",
      "dia_semana": "VIERNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "FUNDAMENTOS DE PROGRAMACIÓN - 1A RA",
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO",
      "dia_semana": "LUNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "FUNDAMENTOS DE PROGRAMACIÓN - 1A RA",
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO",
      "dia_semana": "LUNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 2A SW",
      "docente": "REYES VASQUEZ JOHN PAUL",
      "dia_semana": "LUNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 2A SW",
      "docente": "REYES VASQUEZ JOHN PAUL",
      "dia_semana": "LUNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "PROGRAMACIÓN AVANZADA - 2A RA",
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO",
      "dia_semana": "LUNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "PROGRAMACIÓN AVANZADA - 2A RA",
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO",
      "dia_semana": "LUNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "APLICACIONES ORIENTADAS A SERVICIOS - 7A TI",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "APLICACIONES ORIENTADAS A SERVICIOS - 7A TI",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "PROGRAMACIÓN AVANZADA - 7A TI",
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "PROGRAMACIÓN AVANZADA - 7A TI",
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "AUDITORÍA DE SISTEMAS DE INFORMACIÓN - 7A SW",
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE",
      "dia_semana": "JUEVES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "AUDITORÍA DE SISTEMAS DE INFORMACIÓN - 7A SW",
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE",
      "dia_semana": "JUEVES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 2A SW",
      "docente": "REYES VASQUEZ JOHN PAUL",
      "dia_semana": "JUEVES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 2A SW",
      "docente": "REYES VASQUEZ JOHN PAUL",
      "dia_semana": "JUEVES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "DISEÑO DE PROYECTOS - 8A SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
      "dia_semana": "JUEVES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "DISEÑO DE PROYECTOS - 8A SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
      "dia_semana": "JUEVES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "SOFTWARE DE SIMULACIÓN - 8A SW",
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH",
      "dia_semana": "JUEVES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "SOFTWARE DE SIMULACIÓN - 8A SW",
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH",
      "dia_semana": "JUEVES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "SISTEMAS DE SOPORTE DE DECISIONES - 5B SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "VIERNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "SISTEMAS DE SOPORTE DE DECISIONES - 5B SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "VIERNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "SOFTWARE DE SIMULACIÓN - 4A IT",
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH",
      "dia_semana": "VIERNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "GESTIÓN DE PROYECTOS DE SOFTWARE - 7A SW",
      "docente": "TORRES ABRIL PAULO CESAR",
      "dia_semana": "LUNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "EMPRENDIMIENTO Y GESTIÓN FINANCIERA - 7A SW",
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN",
      "dia_semana": "LUNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "EMPRENDIMIENTO Y GESTIÓN FINANCIERA - 7A SW",
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN",
      "dia_semana": "LUNES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "INTEGRACIÓN DE SISTEMAS - 7A SW",
      "docente": "MAIGUA QUINTEROS ALEX JAVIER",
      "dia_semana": "LUNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "INTEGRACIÓN DE SISTEMAS - 7A SW",
      "docente": "MAIGUA QUINTEROS ALEX JAVIER",
      "dia_semana": "LUNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "INTEGRACIÓN DE SISTEMAS - 7A SW",
      "docente": "MAIGUA QUINTEROS ALEX JAVIER",
      "dia_semana": "LUNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "AUDITORÍA DE TI - 7A SW",
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE",
      "dia_semana": "LUNES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "AUDITORÍA DE TI - 7A SW",
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE",
      "dia_semana": "LUNES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "SISTEMAS DE BASE DE DATOS DISTRIBUIDOS - 7A TI",
      "docente": "MAIGUA QUINTEROS ALEX JAVIER",
      "dia_semana": "MARTES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "SISTEMAS DE BASE DE DATOS DISTRIBUIDOS - 7A TI",
      "docente": "MAIGUA QUINTEROS ALEX JAVIER",
      "dia_semana": "MARTES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "TECNOLOGÍAS DEL APRENDIZAJE - 7A TI",
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO",
      "dia_semana": "MARTES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "TECNOLOGÍAS DEL APRENDIZAJE - 7A TI",
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO",
      "dia_semana": "MARTES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "AUDITORÍA DE SISTEMAS DE INFORMACIÓN - 5A TI",
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE",
      "dia_semana": "MIERCOLES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "AUDITORÍA DE SISTEMAS DE INFORMACIÓN - 5A TI",
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE",
      "dia_semana": "MIERCOLES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "GESTIÓN DE PROYECTOS DE SOFTWARE - 5A TI",
      "docente": "TORRES ABRIL PAULO CESAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "GESTIÓN DE PROYECTOS DE SOFTWARE - 1A RA",
      "docente": "TORRES ABRIL PAULO CESAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "GESTIÓN DE PROYECTOS DE SOFTWARE - 1A RA",
      "docente": "TORRES ABRIL PAULO CESAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "AUDITORÍA DE TI - 1A RA",
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "AUDITORÍA DE TI - 1A RA",
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE",
      "dia_semana": "MIERCOLES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "INTEGRACIÓN DE SISTEMAS - 1A RA",
      "docente": "MAIGUA QUINTEROS ALEX JAVIER",
      "dia_semana": "MIERCOLES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "INTEGRACIÓN DE SISTEMAS - 1A RA",
      "docente": "MAIGUA QUINTEROS ALEX JAVIER",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 7A SW",
      "docente": "GUAMÁN MOLINA JESÚS ISRAEL",
      "dia_semana": "JUEVES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "SISTEMAS DE BASE DE DATOS DISTRIBUIDOS - 7A SW",
      "docente": "MAIGUA QUINTEROS ALEX JAVIER",
      "dia_semana": "JUEVES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "SISTEMAS DE BASE DE DATOS DISTRIBUIDOS - 7A SW",
      "docente": "MAIGUA QUINTEROS ALEX JAVIER",
      "dia_semana": "JUEVES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "TECNOLOGÍAS DEL APRENDIZAJE - 7A SW",
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO",
      "dia_semana": "JUEVES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "TECNOLOGÍAS DEL APRENDIZAJE - 7A SW",
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO",
      "dia_semana": "JUEVES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 2B SW",
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL",
      "dia_semana": "JUEVES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 2B SW",
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL",
      "dia_semana": "JUEVES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "SISTEMAS DE SOPORTE DE DECISIONES - 5B SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "LUNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "PATRONES DE SOFTWARE - 5B SW",
      "docente": "ALDÁS FLORES CLAY FERNANDO",
      "dia_semana": "LUNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "PATRONES DE SOFTWARE - 5B SW",
      "docente": "ALDÁS FLORES CLAY FERNANDO",
      "dia_semana": "LUNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "APLICACIONES ORIENTADAS A SERVICIOS - 5B SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "LUNES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "APLICACIONES ORIENTADAS A SERVICIOS - 5B SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "LUNES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "GESTIÓN DE CALIDAD - 5B SW",
      "docente": "SEVILLA ABARCA MARTHA ESPERANZA",
      "dia_semana": "LUNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "GESTIÓN DE CALIDAD - 5B SW",
      "docente": "SEVILLA ABARCA MARTHA ESPERANZA",
      "dia_semana": "LUNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "INTERACCIÓN HOMBRE MÁQUINA - 5B SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "LUNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "INTERACCIÓN HOMBRE MÁQUINA - 5B SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "LUNES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 2B SW",
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL",
      "dia_semana": "LUNES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 2B SW",
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL",
      "dia_semana": "LUNES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "GOBIERNOS TI - 2A IT",
      "docente": "MORALES LOZADA JOSÉ VICENTE",
      "dia_semana": "MARTES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "GOBIERNOS TI - 2A IT",
      "docente": "MORALES LOZADA JOSÉ VICENTE",
      "dia_semana": "MARTES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "PATRONES DE SOFTWARE - 5B SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "PATRONES DE SOFTWARE - 5B SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "GOBIERNOS TI - 6A TI",
      "docente": "MORALES LOZADA JOSÉ VICENTE",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "GOBIERNOS TI - 6A TI",
      "docente": "MORALES LOZADA JOSÉ VICENTE",
      "dia_semana": "MIERCOLES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "APLICACIONES ORIENTADAS A SERVICIOS - 5B SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "JUEVES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "INTERACCIÓN HUMANO COMPUTADOR - 5B SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "JUEVES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "INTERACCIÓN HUMANO COMPUTADOR - 5B SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "JUEVES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "SISTEMAS DE SOPORTE DE DECISIONES - 5B SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "JUEVES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "SISTEMAS DE SOPORTE DE DECISIONES - 5B SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "JUEVES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "FUNDAMENTOS DE LA INGENIERÍA DE SOFTWARE - 2B SW",
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE",
      "dia_semana": "JUEVES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "FUNDAMENTOS DE LA INGENIERÍA DE SOFTWARE - 2B SW",
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE",
      "dia_semana": "JUEVES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "FUNDAMENTOS DE LA INGENIERÍA DE SOFTWARE - 2A SW",
      "docente": "IBARRA TORRES OSCAR FERNANDO",
      "dia_semana": "JUEVES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "FUNDAMENTOS DE LA INGENIERÍA DE SOFTWARE - 2A SW",
      "docente": "IBARRA TORRES OSCAR FERNANDO",
      "dia_semana": "JUEVES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "BASE DE DATOS - 4A SW",
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO",
      "dia_semana": "LUNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "BASE DE DATOS - 4A SW",
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO",
      "dia_semana": "LUNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "CONMUTACIÓN Y ENRUTAMIENTO AVANZADO - 4A SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "LUNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "CONMUTACIÓN Y ENRUTAMIENTO AVANZADO - 4A SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "LUNES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "APLICACIONES MÓVILES - 4A SW",
      "docente": "ALDÁS FLORES CLAY FERNANDO",
      "dia_semana": "LUNES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "APLICACIONES MÓVILES - 4A SW",
      "docente": "ALDÁS FLORES CLAY FERNANDO",
      "dia_semana": "LUNES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "INTRODUCCIÓN A REDES - 5A TI",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "MARTES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "MODELAMIENTO Y DISEÑO DE SOFTWARE - 3A TI",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "MARTES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "MODELAMIENTO Y DISEÑO DE SOFTWARE - 3A TI",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "MARTES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "FUNDAMENTOS DE BASE DE DATOS - 5A TI",
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO",
      "dia_semana": "MARTES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "FUNDAMENTOS DE BASE DE DATOS - 5A TI",
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO",
      "dia_semana": "MARTES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "BASE DE DATOS - 6A TI",
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO",
      "dia_semana": "MARTES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "BASE DE DATOS - 6A TI",
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO",
      "dia_semana": "MARTES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "GESTIÓN Y EVALUACIÓN DE PROYECTOS TI - 3A SW",
      "docente": "URVINA BARRIONUEVO KLEVER RENATO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "TECNOLOGÍAS Y DESARROLLO WEB - 3B SW",
      "docente": "ALDÁS FLORES CLAY FERNANDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "TECNOLOGÍAS Y DESARROLLO WEB - 3B SW",
      "docente": "ALDÁS FLORES CLAY FERNANDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "FUNDAMENTOS DE BASE DE DATOS - 3A TI",
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "FUNDAMENTOS DE BASE DE DATOS - 3A TI",
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "APLICACIONES MÓVILES - 3A TI",
      "docente": "ALDÁS FLORES CLAY FERNANDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "APLICACIONES MÓVILES - 3A TI",
      "docente": "ALDÁS FLORES CLAY FERNANDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "GESTIÓN DE BASE DE DATOS - 4A SW",
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "GESTIÓN DE BASE DE DATOS - 4A SW",
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "GESTIÓN DE BASE DE DATOS - 4A SW",
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "CONMUTACIÓN Y ENRUTAMIENTO BÁSICO - 5A TI",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "JUEVES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "TECNOLOGÍAS Y DESARROLLO WEB - 3A TI",
      "docente": "ALDÁS FLORES CLAY FERNANDO",
      "dia_semana": "JUEVES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "TECNOLOGÍAS Y DESARROLLO WEB - 3A TI",
      "docente": "ALDÁS FLORES CLAY FERNANDO",
      "dia_semana": "JUEVES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "APLICACIONES MÓVILES - 6A TI",
      "docente": "ALDÁS FLORES CLAY FERNANDO",
      "dia_semana": "JUEVES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "APLICACIONES MÓVILES - 6A TI",
      "docente": "ALDÁS FLORES CLAY FERNANDO",
      "dia_semana": "JUEVES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "GESTIÓN DE BASE DE DATOS - 6A TI",
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO",
      "dia_semana": "JUEVES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "GESTIÓN DE BASE DE DATOS - 4A TI",
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO",
      "dia_semana": "JUEVES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "BASE DE DATOS - 4A SW",
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO",
      "dia_semana": "JUEVES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "BASE DE DATOS - 4A SW",
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO",
      "dia_semana": "JUEVES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "GESTIÓN Y EVALUACIÓN DE PROYECTOS TI - 5A TI",
      "docente": "URVINA BARRIONUEVO KLEVER RENATO",
      "dia_semana": "VIERNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "DESARROLLO ASISTIDO POR SOFTWARE - 7A SW",
      "docente": "JARA MOYA SANTIAGO DAVID",
      "dia_semana": "LUNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "DESARROLLO ASISTIDO POR SOFTWARE - 7A SW",
      "docente": "JARA MOYA SANTIAGO DAVID",
      "dia_semana": "LUNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "INTELIGENCIA ARTIFICIAL - 7A SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
      "dia_semana": "LUNES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "INTELIGENCIA ARTIFICIAL - 7A SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
      "dia_semana": "LUNES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "FUNDAMENTOS DE LA INGENIERÍA DE SOFTWARE - 2B SW",
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE",
      "dia_semana": "LUNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "FUNDAMENTOS DE LA INGENIERÍA DE SOFTWARE - 2B SW",
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE",
      "dia_semana": "LUNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "METODOLOGÍAS ÁGILES - 4A SW",
      "docente": "NARANJO AVALOS HERNAN FABRICIO",
      "dia_semana": "LUNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "METODOLOGÍAS ÁGILES - 4A SW",
      "docente": "NARANJO AVALOS HERNAN FABRICIO",
      "dia_semana": "LUNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "PROBABILIDAD Y ESTADÍSTICA - 7A SW",
      "docente": "ALDÁS SALAZAR DARWIN SANTIAGO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "MODELAMIENTO Y DISEÑO DE SOFTWARE - 7A SW",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "MIERCOLES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "MODELAMIENTO Y DISEÑO DE SOFTWARE - 7A SW",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "MIERCOLES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "METODOLOGÍAS ÁGILES - 2B SW",
      "docente": "NARANJO AVALOS HERNAN FABRICIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "METODOLOGÍAS ÁGILES - 2B SW",
      "docente": "NARANJO AVALOS HERNAN FABRICIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "METODOLOGÍAS ÁGILES - 4B SW",
      "docente": "NARANJO AVALOS HERNAN FABRICIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "BASE DE DATOS - 4B SW",
      "docente": "GUACHIMBOZA VILLALBA MARCO VINICIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "BASE DE DATOS - 6A SW",
      "docente": "GUACHIMBOZA VILLALBA MARCO VINICIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "MODELAMIENTO Y DISEÑO DE SOFTWARE - 3A SW",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "JUEVES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "MODELAMIENTO Y DISEÑO DE SOFTWARE - 3A SW",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "JUEVES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "INTELIGENCIA ARTIFICIAL - 7A SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
      "dia_semana": "JUEVES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "INTELIGENCIA ARTIFICIAL - 7A SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
      "dia_semana": "JUEVES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "INTELIGENCIA ARTIFICIAL - 7A SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
      "dia_semana": "JUEVES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "METODOLOGÍAS ÁGILES - 4B SW",
      "docente": "NARANJO AVALOS HERNAN FABRICIO",
      "dia_semana": "JUEVES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "METODOLOGÍAS ÁGILES - 4B SW",
      "docente": "NARANJO AVALOS HERNAN FABRICIO",
      "dia_semana": "JUEVES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "METODOLOGÍAS ÁGILES - 4B SW",
      "docente": "NARANJO AVALOS HERNAN FABRICIO",
      "dia_semana": "JUEVES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "MANEJO Y CONFIGURACIÓN DEL SOFTWARE - 4B SW",
      "docente": "JARA MOYA SANTIAGO DAVID",
      "dia_semana": "JUEVES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "MANEJO Y CONFIGURACIÓN DEL SOFTWARE - 4B SW",
      "docente": "JARA MOYA SANTIAGO DAVID",
      "dia_semana": "JUEVES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "MANEJO Y CONFIGURACIÓN DEL SOFTWARE - 4B SW",
      "docente": "JARA MOYA SANTIAGO DAVID",
      "dia_semana": "JUEVES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "GESTIÓN DE CALIDAD DEL SOFTWARE - 7A SW",
      "docente": "MAIGUA QUINTEROS ALEX JAVIER",
      "dia_semana": "VIERNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "GESTIÓN DE CALIDAD DEL SOFTWARE - 7A SW",
      "docente": "MAIGUA QUINTEROS ALEX JAVIER",
      "dia_semana": "VIERNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "MANEJO Y CONFIGURACIÓN DEL SOFTWARE - 4A SW",
      "docente": "JARA MOYA SANTIAGO DAVID",
      "dia_semana": "VIERNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "MANEJO Y CONFIGURACIÓN DEL SOFTWARE - 4A SW",
      "docente": "JARA MOYA SANTIAGO DAVID",
      "dia_semana": "VIERNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "METODOLOGÍAS ÁGILES - 4B SW",
      "docente": "NARANJO AVALOS HERNAN FABRICIO",
      "dia_semana": "VIERNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "METODOLOGÍAS ÁGILES - 4B SW",
      "docente": "NARANJO AVALOS HERNAN FABRICIO",
      "dia_semana": "VIERNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "SISTEMAS DE SOPORTE DE DECISIONES - 5A SW",
      "docente": "ÁLVAREZ MAYORGA EDISON HOMERO",
      "dia_semana": "LUNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "SISTEMAS DE SOPORTE DE DECISIONES - 5A SW",
      "docente": "ÁLVAREZ MAYORGA EDISON HOMERO",
      "dia_semana": "LUNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "SISTEMAS OPERATIVOS - 5A SW",
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN",
      "dia_semana": "LUNES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "SISTEMAS OPERATIVOS - 5A SW",
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN",
      "dia_semana": "LUNES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "ADMINISTRACIÓN DE BASE DE DATOS - 5A SW",
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO",
      "dia_semana": "LUNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "ADMINISTRACIÓN DE BASE DE DATOS - 5A SW",
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO",
      "dia_semana": "LUNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "BASE DE DATOS - 4B SW",
      "docente": "GUACHIMBOZA VILLALBA MARCO VINICIO",
      "dia_semana": "LUNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "BASE DE DATOS - 4B SW",
      "docente": "GUACHIMBOZA VILLALBA MARCO VINICIO",
      "dia_semana": "LUNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "INGENIERÍA DE SOFTWARE - 4B SW",
      "docente": "IBARRA TORRES OSCAR FERNANDO",
      "dia_semana": "LUNES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "INGENIERÍA DE SOFTWARE - 4B SW",
      "docente": "IBARRA TORRES OSCAR FERNANDO",
      "dia_semana": "LUNES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "SISTEMAS DE SOPORTE DE DECISIONES - 7A TI",
      "docente": "ÁLVAREZ MAYORGA EDISON HOMERO",
      "dia_semana": "MARTES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "PROGRAMACIÓN AVANZADA - 7A TI",
      "docente": "ROBALINO PEÑA EDGAR FREDDY",
      "dia_semana": "MARTES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "PROGRAMACIÓN AVANZADA - 7A TI",
      "docente": "ROBALINO PEÑA EDGAR FREDDY",
      "dia_semana": "MARTES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "INTERACCIÓN HUMANO COMPUTADOR - 5A SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "MARTES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "INTERACCIÓN HUMANO / COMPUTADOR - 5A SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "MARTES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "BASE DE DATOS - 6A TI",
      "docente": "GUACHIMBOZA VILLALBA MARCO VINICIO",
      "dia_semana": "MARTES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "BASE DE DATOS - 6A TI",
      "docente": "GUACHIMBOZA VILLALBA MARCO VINICIO",
      "dia_semana": "MARTES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "SISTEMAS DE SOPORTE DE DECISIONES - 6A TI",
      "docente": "ÁLVAREZ MAYORGA EDISON HOMERO",
      "dia_semana": "MARTES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "SISTEMAS DE SOPORTE DE DECISIONES - 6A TI",
      "docente": "ÁLVAREZ MAYORGA EDISON HOMERO",
      "dia_semana": "MARTES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "CONMUTACIÓN Y ENRUTAMIENTO AVANZADO - 4A TI",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "MARTES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "CONMUTACIÓN Y ENRUTAMIENTO AVANZADO - 4A TI",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "MARTES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "INTELIGENCIA DE NEGOCIOS - 5A SW",
      "docente": "ÁLVAREZ MAYORGA EDISON HOMERO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "INTERACCIÓN HUMANO / COMPUTADOR - 5A SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "INTERACCIÓN HUMANO COMPUTADOR - 5A SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "INTERACCIÓN HUMANO / COMPUTADOR - 5A SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "DISEÑO DE PROYECTOS - 4B SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "DISEÑO DE PROYECTOS - 4B SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "SISTEMAS DE SOPORTE DE DECISIONES - 6A TI",
      "docente": "ÁLVAREZ MAYORGA EDISON HOMERO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "SISTEMAS DE SOPORTE DE DECISIONES - 6A TI",
      "docente": "ÁLVAREZ MAYORGA EDISON HOMERO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "SISTEMAS DE SOPORTE DE DECISIONES - 5A SW",
      "docente": "ÁLVAREZ MAYORGA EDISON HOMERO",
      "dia_semana": "JUEVES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "PATRONES DE SOFTWARE - 5A SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "JUEVES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "PATRONES DE SOFTWARE - 5A SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "JUEVES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 5A SW",
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL",
      "dia_semana": "JUEVES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 5A SW",
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL",
      "dia_semana": "JUEVES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "INGENIERÍA DE SOFTWARE - 8A SW",
      "docente": "IBARRA TORRES OSCAR FERNANDO",
      "dia_semana": "JUEVES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "INGENIERÍA DE SOFTWARE - 8A SW",
      "docente": "IBARRA TORRES OSCAR FERNANDO",
      "dia_semana": "JUEVES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "SISTEMAS DE SOPORTE DE DECISIONES - 6A TI",
      "docente": "ÁLVAREZ MAYORGA EDISON HOMERO",
      "dia_semana": "JUEVES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "SISTEMAS DE SOPORTE DE DECISIONES - 6A TI",
      "docente": "ÁLVAREZ MAYORGA EDISON HOMERO",
      "dia_semana": "JUEVES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "ADMINISTRACIÓN DE BASE DE DATOS - 6A TI",
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO",
      "dia_semana": "JUEVES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "ADMINISTRACIÓN DE BASE DE DATOS - 6A TI",
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO",
      "dia_semana": "JUEVES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "INTELIGENCIA DE NEGOCIOS - 7A TI",
      "docente": "ÁLVAREZ MAYORGA EDISON HOMERO",
      "dia_semana": "VIERNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "INTELIGENCIA DE NEGOCIOS - 7A TI",
      "docente": "ÁLVAREZ MAYORGA EDISON HOMERO",
      "dia_semana": "VIERNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "ADMINISTRACIÓN DE BASE DE DATOS - 6A TI",
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO",
      "dia_semana": "VIERNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "ADMINISTRACIÓN DE BASE DE DATOS - 6A TI",
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO",
      "dia_semana": "VIERNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "REDES - 4A SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "VIERNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "REDES - 4A SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "VIERNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "PROGRAMACIÓN ORIENTADA A OBJETOS - 2A SW",
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR",
      "dia_semana": "LUNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "PROGRAMACIÓN ORIENTADA A OBJETOS - 2A SW",
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR",
      "dia_semana": "LUNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "PROGRAMACIÓN ORIENTADA A OBJETOS - 2A SW",
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR",
      "dia_semana": "LUNES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 1A TI",
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE",
      "dia_semana": "MARTES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "ESTRUCTURA DE DATOS - 1A TI",
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR",
      "dia_semana": "MARTES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "ESTRUCTURA DE DATOS - 1B TI",
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR",
      "dia_semana": "MARTES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "MODELAMIENTO Y DISEÑO DE SOFTWARE - 1B TI",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "MARTES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "MODELAMIENTO Y DISEÑO DE SOFTWARE - 1B TI",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "MARTES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "FUNDAMENTOS DE LA INGENIERÍA DE SOFTWARE - 2A TI",
      "docente": "IBARRA TORRES OSCAR FERNANDO",
      "dia_semana": "MARTES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "FUNDAMENTOS DE LA INGENIERÍA DE SOFTWARE - 2A TI",
      "docente": "IBARRA TORRES OSCAR FERNANDO",
      "dia_semana": "MARTES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "SISTEMAS OPERATIVOS - 2A TI",
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN",
      "dia_semana": "MARTES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "SISTEMAS OPERATIVOS - 2A TI",
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN",
      "dia_semana": "MARTES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "REALIDAD NACIONAL - 2A TI",
      "docente": "MORALES LOZADA JOSÉ VICENTE",
      "dia_semana": "MARTES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "REALIDAD NACIONAL - 2A TI",
      "docente": "MORALES LOZADA JOSÉ VICENTE",
      "dia_semana": "MARTES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "FUNDAMENTOS DE PROGRAMACIÓN - 1B TI",
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL",
      "dia_semana": "MIERCOLES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "FUNDAMENTOS DE PROGRAMACIÓN - 3A SW",
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL",
      "dia_semana": "MIERCOLES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 3A SW",
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE",
      "dia_semana": "MIERCOLES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 3A SW",
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "SISTEMAS OPERATIVOS - 2A SW",
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "SISTEMAS OPERATIVOS - 2A SW",
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "SISTEMAS OPERATIVOS - 2A SW",
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "ESTRUCTURA DE DATOS - 2A SW",
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "ESTRUCTURA DE DATOS - 2A TI",
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "ESTRUCTURA DE DATOS - 2A TI",
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "FUNDAMENTOS DE PROGRAMACIÓN - 1B TI",
      "docente": "NARANJO AVALOS HERNAN FABRICIO",
      "dia_semana": "JUEVES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "FUNDAMENTOS DE PROGRAMACIÓN - 1B TI",
      "docente": "NARANJO AVALOS HERNAN FABRICIO",
      "dia_semana": "JUEVES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "ESTRUCTURA DE DATOS - 3A SW",
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR",
      "dia_semana": "JUEVES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "ESTRUCTURA DE DATOS - 3A SW",
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR",
      "dia_semana": "JUEVES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "ESTRUCTURA DE DATOS - 3A SW",
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR",
      "dia_semana": "JUEVES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "GESTIÓN DE PRUEBAS E IMPLANTACIÓN DE SOFTWARE - 6A SW",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "JUEVES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "GESTIÓN DE PRUEBAS E IMPLANTACIÓN DE SOFTWARE - 6A SW",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "JUEVES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "GESTIÓN DE PRUEBAS E IMPLANTACIÓN DE SOFTWARE - 6A SW",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "JUEVES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "FUNDAMENTOS DE PROGRAMACIÓN - 2A TI",
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO",
      "dia_semana": "JUEVES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "PROGRAMACIÓN ORIENTADA A OBJETOS - 2A SW",
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR",
      "dia_semana": "JUEVES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "PROGRAMACIÓN ORIENTADA A OBJETOS - 2A SW",
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR",
      "dia_semana": "JUEVES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "FUNDAMENTOS DE PROGRAMACIÓN - 1B TI",
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL",
      "dia_semana": "VIERNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "FUNDAMENTOS DE PROGRAMACIÓN - 1B TI",
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL",
      "dia_semana": "VIERNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "FUNDAMENTOS DE LA INGENIERÍA DE SOFTWARE - 2A SW",
      "docente": "IBARRA TORRES OSCAR FERNANDO",
      "dia_semana": "VIERNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "FUNDAMENTOS DE LA INGENIERÍA DE SOFTWARE - 2A SW",
      "docente": "IBARRA TORRES OSCAR FERNANDO",
      "dia_semana": "VIERNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "INTRODUCCIÓN A REDES - 3A SW",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "LUNES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "INTRODUCCIÓN A REDES - 3A SW",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "LUNES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "SEGURIDAD EN EL DESARROLLO DEL SOFTWARE - 8A SW",
      "docente": "IBARRA TORRES OSCAR FERNANDO",
      "dia_semana": "LUNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "SEGURIDAD EN EL DESARROLLO DEL SOFTWARE - 8A SW",
      "docente": "IBARRA TORRES OSCAR FERNANDO",
      "dia_semana": "LUNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "INGENIERÍA ECONÓMICA PARA SOFTWARE - 8A SW",
      "docente": "JARA MOYA SANTIAGO DAVID",
      "dia_semana": "LUNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "INGENIERÍA ECONÓMICA PARA SOFTWARE - 8A SW",
      "docente": "JARA MOYA SANTIAGO DAVID",
      "dia_semana": "LUNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "INGENIERÍA ECONÓMICA PARA SOFTWARE - 8A SW",
      "docente": "JARA MOYA SANTIAGO DAVID",
      "dia_semana": "LUNES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "ARQUITECTURA Y PLATAFORMAS DE SERVIDORES - 3A TI",
      "docente": "GUEVARA AULESTIA DAVID OMAR",
      "dia_semana": "MARTES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "ARQUITECTURA Y PLATAFORMAS DE SERVIDORES - 5A IT",
      "docente": "GUEVARA AULESTIA DAVID OMAR",
      "dia_semana": "MARTES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "CONMUTACIÓN Y ENRUTAMIENTO BÁSICO - 5A TI",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "MARTES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "CONMUTACIÓN Y ENRUTAMIENTO BÁSICO - 5A TI",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "MARTES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "SEGURIDAD DE LA INFORMACIÓN EN REDES DE COMUNICACIÓN DE DATOS - 5A IT",
      "docente": "GUEVARA AULESTIA DAVID OMAR",
      "dia_semana": "MARTES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "SEGURIDAD DE LA INFORMACIÓN EN REDES DE COMUNICACIÓN DE DATOS - 5A IT",
      "docente": "GUEVARA AULESTIA DAVID OMAR",
      "dia_semana": "MARTES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "SEGURIDAD DE LA INFORMACIÓN EN REDES DE COMUNICACIÓN DE DATOS - 5A IT",
      "docente": "GUEVARA AULESTIA DAVID OMAR",
      "dia_semana": "MARTES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "INGENIERÍA DE SOFTWARE - 5A IT",
      "docente": "IBARRA TORRES OSCAR FERNANDO",
      "dia_semana": "MARTES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "INGENIERÍA DE SOFTWARE - 5A IT",
      "docente": "IBARRA TORRES OSCAR FERNANDO",
      "dia_semana": "MARTES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "INTRODUCCIÓN A REDES - 5A TI",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "INTRODUCCIÓN A REDES - 5A TI",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "ADMINISTRACIÓN DE SISTEMAS OPERATIVOS - 8A TI",
      "docente": "GUEVARA AULESTIA DAVID OMAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "ADMINISTRACIÓN DE SISTEMAS OPERATIVOS - 8A TI",
      "docente": "GUEVARA AULESTIA DAVID OMAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "ADMINISTRACIÓN DE SISTEMAS OPERATIVOS - 8A TI",
      "docente": "GUEVARA AULESTIA DAVID OMAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "MANEJO Y CONFIGURACIÓN DEL SOFTWARE - 4A TI",
      "docente": "JARA MOYA SANTIAGO DAVID",
      "dia_semana": "MIERCOLES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "MANEJO Y CONFIGURACIÓN DEL SOFTWARE - 4A TI",
      "docente": "JARA MOYA SANTIAGO DAVID",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "MANEJO Y CONFIGURACIÓN DEL SOFTWARE - 4A TI",
      "docente": "JARA MOYA SANTIAGO DAVID",
      "dia_semana": "MIERCOLES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "FUNDAMENTOS DE REDES Y COMUNICACIÓN DE DATOS - 3A SW",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "JUEVES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "FUNDAMENTOS DE REDES Y COMUNICACIÓN DE DATOS - 3A SW",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "JUEVES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "SEGURIDAD DE LA INFORMACIÓN EN REDES DE COMUNICACIÓN DE DATOS - 4A TI",
      "docente": "GUEVARA AULESTIA DAVID OMAR",
      "dia_semana": "JUEVES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "SEGURIDAD DE LA INFORMACIÓN EN REDES DE COMUNICACIÓN DE DATOS - 4A TI",
      "docente": "GUEVARA AULESTIA DAVID OMAR",
      "dia_semana": "JUEVES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "SEGURIDAD DE LA INFORMACIÓN EN REDES DE COMUNICACIÓN DE DATOS - 4A TI",
      "docente": "GUEVARA AULESTIA DAVID OMAR",
      "dia_semana": "JUEVES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "SEGURIDAD EN EL DESARROLLO DEL SOFTWARE - 8A SW",
      "docente": "IBARRA TORRES OSCAR FERNANDO",
      "dia_semana": "JUEVES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "SEGURIDAD EN EL DESARROLLO DEL SOFTWARE - 8A SW",
      "docente": "IBARRA TORRES OSCAR FERNANDO",
      "dia_semana": "JUEVES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "CONMUTACIÓN Y ENRUTAMIENTO BÁSICO - 5A TI",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "VIERNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "CONMUTACIÓN Y ENRUTAMIENTO BÁSICO - 5A TI",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "VIERNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "ADMINISTRACIÓN DE SISTEMAS OPERATIVOS - 4A TI",
      "docente": "GUEVARA AULESTIA DAVID OMAR",
      "dia_semana": "VIERNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "ADMINISTRACIÓN DE SISTEMAS OPERATIVOS - 4A TI",
      "docente": "GUEVARA AULESTIA DAVID OMAR",
      "dia_semana": "VIERNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "ADMINISTRACIÓN DE SISTEMAS OPERATIVOS - 4A TI",
      "docente": "GUEVARA AULESTIA DAVID OMAR",
      "dia_semana": "VIERNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "APLICACIONES WEB Y MÓVILES - 6A SW",
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO",
      "dia_semana": "LUNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "APLICACIONES WEB Y MÓVILES - 6A SW",
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO",
      "dia_semana": "LUNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "APLICACIONES DISTRIBUIDAS - 6A SW",
      "docente": "MAIGUA QUINTEROS ALEX JAVIER",
      "dia_semana": "LUNES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "APLICACIONES DISTRIBUIDAS - 6A SW",
      "docente": "MAIGUA QUINTEROS ALEX JAVIER",
      "dia_semana": "LUNES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "DESARROLLO DE PROYECTOS - 7A IT",
      "docente": "URVINA BARRIONUEVO KLEVER RENATO",
      "dia_semana": "MARTES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "DESARROLLO DE PROYECTOS - 7A IT",
      "docente": "URVINA BARRIONUEVO KLEVER RENATO",
      "dia_semana": "MARTES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "APLICACIONES WEB Y MÓVILES - 7A TI",
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO",
      "dia_semana": "MARTES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "APLICACIONES WEB Y MÓVILES - 7A TI",
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO",
      "dia_semana": "MARTES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "DISEÑO DE PROYECTOS - 7A TI",
      "docente": "MAYORGA MAYORGA FRANKLIN OSWALDO",
      "dia_semana": "MARTES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "DISEÑO DE PROYECTOS - 7A TI",
      "docente": "MAYORGA MAYORGA FRANKLIN OSWALDO",
      "dia_semana": "MARTES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "DISEÑO DE PROYECTOS - 7A TI",
      "docente": "MAYORGA MAYORGA FRANKLIN OSWALDO",
      "dia_semana": "MARTES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "CONMUTACIÓN Y ENRUTAMIENTO DE REDES - 9A TI",
      "docente": "MANZANO VILLAFUERTE VICTOR SANTIAGO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "ADMINISTRACIÓN DE REDES - 9A TI",
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "ADMINISTRACIÓN DE REDES - 9A TI",
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "EMPRENDIMIENTO Y GESTIÓN FINANCIERA - 9A TI",
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "EMPRENDIMIENTO Y GESTIÓN FINANCIERA - 9A TI",
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "APLICACIONES WEB Y MÓVILES - 6A SW",
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "APLICACIONES WEB Y MÓVILES - 6A SW",
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "APLICACIONES DISTRIBUIDAS - 8A TI",
      "docente": "MAIGUA QUINTEROS ALEX JAVIER",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "APLICACIONES DISTRIBUIDAS - 8A TI",
      "docente": "MAIGUA QUINTEROS ALEX JAVIER",
      "dia_semana": "MIERCOLES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "DESARROLLO DE PROYECTOS - 7A IT",
      "docente": "URVINA BARRIONUEVO KLEVER RENATO",
      "dia_semana": "JUEVES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "DESARROLLO DE PROYECTOS - 7A TI",
      "docente": "URVINA BARRIONUEVO KLEVER RENATO",
      "dia_semana": "JUEVES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "ADMINISTRACIÓN DE REDES - 7A TI",
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO",
      "dia_semana": "JUEVES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "ADMINISTRACIÓN DE REDES - 7A TI",
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO",
      "dia_semana": "JUEVES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "DISEÑO DE PROYECTOS - 6A SW",
      "docente": "MAYORGA MAYORGA FRANKLIN OSWALDO",
      "dia_semana": "JUEVES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "DISEÑO DE PROYECTOS - 6A SW",
      "docente": "MAYORGA MAYORGA FRANKLIN OSWALDO",
      "dia_semana": "JUEVES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "DISEÑO DE PROYECTOS - 6A SW",
      "docente": "MAYORGA MAYORGA FRANKLIN OSWALDO",
      "dia_semana": "JUEVES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "CONMUTACIÓN Y ENRUTAMIENTO DE REDES - 7A IT",
      "docente": "MANZANO VILLAFUERTE VICTOR SANTIAGO",
      "dia_semana": "VIERNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "DESARROLLO DE PROYECTOS - 9A TI",
      "docente": "URVINA BARRIONUEVO KLEVER RENATO",
      "dia_semana": "VIERNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "DESARROLLO DE PROYECTOS - 9A TI",
      "docente": "URVINA BARRIONUEVO KLEVER RENATO",
      "dia_semana": "VIERNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "APLICACIONES DISTRIBUIDAS - 6A SW",
      "docente": "MAIGUA QUINTEROS ALEX JAVIER",
      "dia_semana": "VIERNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "APLICACIONES DISTRIBUIDAS - 6A SW",
      "docente": "MAIGUA QUINTEROS ALEX JAVIER",
      "dia_semana": "VIERNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "SISTEMAS EMBEBIDOS - 6A RA",
      "docente": "GARCIA SÁNCHEZ MARCELO VLADIMIR",
      "dia_semana": "LUNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "SISTEMAS EMBEBIDOS - 6A RA",
      "docente": "GARCIA SÁNCHEZ MARCELO VLADIMIR",
      "dia_semana": "LUNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "INSTRUMENTACIÓN INDUSTRIAL - 6A RA",
      "docente": "ESCOBAR NARANJO JUAN CAMILO",
      "dia_semana": "LUNES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "INSTRUMENTACIÓN INDUSTRIAL - 6A RA",
      "docente": "ESCOBAR NARANJO JUAN CAMILO",
      "dia_semana": "LUNES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 7A II",
      "docente": "SEVILLA ABARCA MARTHA ESPERANZA",
      "dia_semana": "MARTES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 7A II",
      "docente": "SEVILLA ABARCA MARTHA ESPERANZA",
      "dia_semana": "MARTES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 7A II",
      "docente": "SEVILLA ABARCA MARTHA ESPERANZA",
      "dia_semana": "MARTES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "MÁQUINAS ELÉCTRICAS - 8A II",
      "docente": "LOPEZ FLORES MAURICIO XAVIER",
      "dia_semana": "MARTES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "MÁQUINAS ELÉCTRICAS - 8A II",
      "docente": "LOPEZ FLORES MAURICIO XAVIER",
      "dia_semana": "MARTES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "MÁQUINAS ELÉCTRICAS - 8A II",
      "docente": "LOPEZ FLORES MAURICIO XAVIER",
      "dia_semana": "MARTES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "MÁQUINAS ELÉCTRICAS - 8A II",
      "docente": "LOPEZ FLORES MAURICIO XAVIER",
      "dia_semana": "MARTES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 1B IT",
      "docente": "SEVILLA ABARCA MARTHA ESPERANZA",
      "dia_semana": "MIERCOLES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 1B IT",
      "docente": "SEVILLA ABARCA MARTHA ESPERANZA",
      "dia_semana": "MIERCOLES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "AUTOMATIZACIÓN INDUSTRIAL Y ROBÓTICA - 1B IT",
      "docente": "LOPEZ FLORES MAURICIO XAVIER",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "AUTOMATIZACIÓN INDUSTRIAL Y ROBÓTICA - 4A II",
      "docente": "LOPEZ FLORES MAURICIO XAVIER",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "AUTOMATIZACIÓN INDUSTRIAL Y ROBÓTICA - 4A II",
      "docente": "LOPEZ FLORES MAURICIO XAVIER",
      "dia_semana": "MIERCOLES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "AUTOMATIZACIÓN INDUSTRIAL Y ROBÓTICA - 4C II",
      "docente": "ENCALADA RUIZ PATRICIO GERMÁN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "AUTOMATIZACIÓN INDUSTRIAL Y ROBÓTICA - 4C II",
      "docente": "ENCALADA RUIZ PATRICIO GERMÁN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "AUTOMATIZACIÓN INDUSTRIAL Y ROBÓTICA - 4C II",
      "docente": "ENCALADA RUIZ PATRICIO GERMÁN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "INSTRUMENTACIÓN VIRTUAL - 1B IT",
      "docente": "CORDOVA CORDOVA ÉDGAR PATRICIO",
      "dia_semana": "JUEVES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "INSTRUMENTACIÓN VIRTUAL - 1B IT",
      "docente": "CORDOVA CORDOVA ÉDGAR PATRICIO",
      "dia_semana": "JUEVES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "TECNOLOGÍAS DE LA INFORMACIÓN Y DE LA COMUNICACIÓN - 1B IT",
      "docente": "CARRILLO RIOS SANDRA LUCRECIA",
      "dia_semana": "JUEVES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "TECNOLOGÍAS DE LA INFORMACIÓN Y DE LA COMUNICACIÓN - 1B IT",
      "docente": "CARRILLO RIOS SANDRA LUCRECIA",
      "dia_semana": "JUEVES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "SISTEMAS EMBEBIDOS - 8A II",
      "docente": "GARCIA SÁNCHEZ MARCELO VLADIMIR",
      "dia_semana": "JUEVES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "SISTEMAS EMBEBIDOS - 8A II",
      "docente": "GARCIA SÁNCHEZ MARCELO VLADIMIR",
      "dia_semana": "JUEVES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "SISTEMAS EMBEBIDOS - 8A II",
      "docente": "GARCIA SÁNCHEZ MARCELO VLADIMIR",
      "dia_semana": "JUEVES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "SISTEMAS DE TELEFONÍA - 8B II",
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO",
      "dia_semana": "JUEVES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "SISTEMAS DE TELEFONÍA - 8B II",
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO",
      "dia_semana": "JUEVES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 1A IT",
      "docente": "SEVILLA ABARCA MARTHA ESPERANZA",
      "dia_semana": "VIERNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "COMUNICACIONES AVANZADAS - 8A IT",
      "docente": "ZAMBRANO VALVERDE TATIANA PAOLA",
      "dia_semana": "VIERNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "INSTRUMENTACIÓN INDUSTRIAL - 6A RA",
      "docente": "ESCOBAR NARANJO JUAN CAMILO",
      "dia_semana": "VIERNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "INSTRUMENTACIÓN INDUSTRIAL - 6A RA",
      "docente": "ESCOBAR NARANJO JUAN CAMILO",
      "dia_semana": "VIERNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "AUTOMATIZACIÓN INDUSTRIAL Y ROBÓTICA - 8B II",
      "docente": "ENCALADA RUIZ PATRICIO GERMÁN",
      "dia_semana": "VIERNES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 1",
      "nombre_curso": "AUTOMATIZACIÓN INDUSTRIAL Y ROBÓTICA - 8B II",
      "docente": "ENCALADA RUIZ PATRICIO GERMÁN",
      "dia_semana": "VIERNES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "TECNOLOGÍAS DE LA INFORMACIÓN Y DE LA COMUNICACIÓN - 1B II",
      "docente": "CARRILLO RIOS SANDRA LUCRECIA",
      "dia_semana": "MARTES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "ADMINISTRACIÓN DE LA PRODUCCIÓN - 5A II",
      "docente": "REYES VASQUEZ JOHN PAUL",
      "dia_semana": "MARTES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "ADMINISTRACIÓN DE LA PRODUCCIÓN - 1A IT",
      "docente": "REYES VASQUEZ JOHN PAUL",
      "dia_semana": "MARTES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "ADMINISTRACIÓN DE LA PRODUCCIÓN - 1A IT",
      "docente": "REYES VASQUEZ JOHN PAUL",
      "dia_semana": "MARTES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 6A IT",
      "docente": "REYES VASQUEZ JOHN PAUL",
      "dia_semana": "MARTES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 6A IT",
      "docente": "REYES VASQUEZ JOHN PAUL",
      "dia_semana": "MARTES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "SISTEMAS CAD/CAM - 6A II",
      "docente": "LÓPEZ ARBOLEDA JESSICA PAOLA",
      "dia_semana": "MARTES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "SISTEMAS CAD/CAM - 6A II",
      "docente": "LÓPEZ ARBOLEDA JESSICA PAOLA",
      "dia_semana": "MARTES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "SISTEMAS CAD/CAM - 8A II",
      "docente": "LÓPEZ ARBOLEDA JESSICA PAOLA",
      "dia_semana": "MARTES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "TECNOLOGÍAS DE LA INFORMACIÓN Y DE LA COMUNICACIÓN - 1B II",
      "docente": "CARRILLO RIOS SANDRA LUCRECIA",
      "dia_semana": "MIERCOLES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "TECNOLOGÍAS DE LA INFORMACIÓN Y DE LA COMUNICACIÓN - 5A II",
      "docente": "MORALES LOZADA JOSÉ VICENTE",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "TECNOLOGÍAS DE LA INFORMACIÓN Y DE LA COMUNICACIÓN - 5A II",
      "docente": "MORALES LOZADA JOSÉ VICENTE",
      "dia_semana": "MIERCOLES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "REDES DE DATOS - 2A II",
      "docente": "ROBALINO PEÑA EDGAR FREDDY",
      "dia_semana": "MIERCOLES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "REDES DE DATOS - 2A II",
      "docente": "ROBALINO PEÑA EDGAR FREDDY",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "MÁQUINAS ELÉCTRICAS - 6A II",
      "docente": "LOPEZ FLORES MAURICIO XAVIER",
      "dia_semana": "MIERCOLES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "MÁQUINAS ELÉCTRICAS - 6A II",
      "docente": "LOPEZ FLORES MAURICIO XAVIER",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "INSTRUMENTACIÓN INDUSTRIAL - 1A II",
      "docente": "LOPEZ FLORES MAURICIO XAVIER",
      "dia_semana": "JUEVES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "INSTRUMENTACIÓN INDUSTRIAL - 1A II",
      "docente": "LOPEZ FLORES MAURICIO XAVIER",
      "dia_semana": "JUEVES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "TECNOLOGÍAS DE LA INFORMACIÓN Y DE LA COMUNICACIÓN - 1A IT",
      "docente": "MORALES LOZADA JOSÉ VICENTE",
      "dia_semana": "JUEVES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "TECNOLOGÍAS DE LA INFORMACIÓN Y DE LA COMUNICACIÓN - 1A IT",
      "docente": "MORALES LOZADA JOSÉ VICENTE",
      "dia_semana": "JUEVES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "MÁQUINAS ELÉCTRICAS - 6A IT",
      "docente": "LOPEZ FLORES MAURICIO XAVIER",
      "dia_semana": "JUEVES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "MÁQUINAS ELÉCTRICAS - 6A IT",
      "docente": "LOPEZ FLORES MAURICIO XAVIER",
      "dia_semana": "JUEVES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "SIMULACIÓN Y LABORATORIO - 6A IT",
      "docente": "REYES VASQUEZ JOHN PAUL",
      "dia_semana": "JUEVES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "SIMULACIÓN Y LABORATORIO - 4B II",
      "docente": "REYES VASQUEZ JOHN PAUL",
      "dia_semana": "JUEVES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "SEGURIDAD INDUSTRIAL - 4B II",
      "docente": "TIGRE ORTEGA FRANKLIN GEOVANNY",
      "dia_semana": "JUEVES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "SEGURIDAD INDUSTRIAL - 4B II",
      "docente": "TIGRE ORTEGA FRANKLIN GEOVANNY",
      "dia_semana": "JUEVES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "TECNOLOGÍAS DE LA INFORMACIÓN Y DE LA COMUNICACIÓN - 1B IT",
      "docente": "MORALES LOZADA JOSÉ VICENTE",
      "dia_semana": "VIERNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "TECNOLOGÍAS DE LA INFORMACIÓN Y DE LA COMUNICACIÓN - 1B IT",
      "docente": "MORALES LOZADA JOSÉ VICENTE",
      "dia_semana": "VIERNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "MÁQUINAS ELÉCTRICAS - 4C II",
      "docente": "LOPEZ FLORES MAURICIO XAVIER",
      "dia_semana": "VIERNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "MÁQUINAS ELÉCTRICAS - 4C II",
      "docente": "LOPEZ FLORES MAURICIO XAVIER",
      "dia_semana": "VIERNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. INDUSTRIAL 2",
      "nombre_curso": "SIMULACIÓN Y LABORATORIO - 8A II",
      "docente": "REYES VASQUEZ JOHN PAUL",
      "dia_semana": "VIERNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "SOFTWARE DE SIMULACIÓN - 3A RA",
      "docente": "SALAZAR LOGROÑO FRANKLIN WILFRIDO",
      "dia_semana": "LUNES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "SOFTWARE DE SIMULACIÓN - 3A RA",
      "docente": "SALAZAR LOGROÑO FRANKLIN WILFRIDO",
      "dia_semana": "LUNES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "DISEÑO Y ORGANIZACIÓN DE PLANTAS - 3A RA",
      "docente": "NARANJO CHIRIBOGA ISRAEL ERNESTO",
      "dia_semana": "LUNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "DISEÑO Y ORGANIZACIÓN DE PLANTAS - 3A RA",
      "docente": "NARANJO CHIRIBOGA ISRAEL ERNESTO",
      "dia_semana": "LUNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "MÁQUINAS ELÉCTRICAS - 3A RA",
      "docente": "LOPEZ FLORES MAURICIO XAVIER",
      "dia_semana": "LUNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "MÁQUINAS ELÉCTRICAS - 3A RA",
      "docente": "LOPEZ FLORES MAURICIO XAVIER",
      "dia_semana": "LUNES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "DIBUJO ASISTIDO POR COMPUTADOR - 3A RA",
      "docente": "TIGRE ORTEGA FRANKLIN GEOVANNY",
      "dia_semana": "LUNES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "DIBUJO ASISTIDO POR COMPUTADOR - 3A RA",
      "docente": "TIGRE ORTEGA FRANKLIN GEOVANNY",
      "dia_semana": "LUNES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 5B II",
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL",
      "dia_semana": "MARTES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "SOFTWARE DE SIMULACIÓN - 5B II",
      "docente": "SALAZAR LOGROÑO FRANKLIN WILFRIDO",
      "dia_semana": "MARTES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "HIGIENE INDUSTRIAL - 6A II",
      "docente": "MORALES PERRAZO LUIS ALBERTO",
      "dia_semana": "MARTES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "HIGIENE INDUSTRIAL - 6A II",
      "docente": "MORALES PERRAZO LUIS ALBERTO",
      "dia_semana": "MARTES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "FUNDAMENTOS DE PROGRAMACIÓN - 4A II",
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO",
      "dia_semana": "MARTES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "FUNDAMENTOS DE PROGRAMACIÓN - 4A II",
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO",
      "dia_semana": "MARTES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "ADMINISTRACIÓN DE LA PRODUCCIÓN - 1A TI",
      "docente": "REYES VASQUEZ JOHN PAUL",
      "dia_semana": "MIERCOLES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "DIBUJO ASISTIDO POR COMPUTADOR - 6A II",
      "docente": "TIGRE ORTEGA FRANKLIN GEOVANNY",
      "dia_semana": "MIERCOLES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "DIBUJO ASISTIDO POR COMPUTADOR - 6A II",
      "docente": "TIGRE ORTEGA FRANKLIN GEOVANNY",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "FUNDAMENTOS DE PROGRAMACIÓN - 6A II",
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "FUNDAMENTOS DE PROGRAMACIÓN - 6A II",
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "SEGURIDAD EN EL DESARROLLO DEL SOFTWARE - 2A IT",
      "docente": "IBARRA TORRES OSCAR FERNANDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "SEGURIDAD EN EL DESARROLLO DEL SOFTWARE - 2A IT",
      "docente": "IBARRA TORRES OSCAR FERNANDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "INSTRUMENTACIÓN INDUSTRIAL - 5A II",
      "docente": "ENCALADA RUIZ PATRICIO GERMÁN",
      "dia_semana": "JUEVES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "INSTRUMENTACIÓN INDUSTRIAL - 5A II",
      "docente": "ENCALADA RUIZ PATRICIO GERMÁN",
      "dia_semana": "JUEVES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "SOFTWARE DE SIMULACIÓN - 5A II",
      "docente": "SALAZAR LOGROÑO FRANKLIN WILFRIDO",
      "dia_semana": "JUEVES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "SOFTWARE DE SIMULACIÓN - 5A II",
      "docente": "SALAZAR LOGROÑO FRANKLIN WILFRIDO",
      "dia_semana": "JUEVES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "HIGIENE INDUSTRIAL - 4A II",
      "docente": "MORALES PERRAZO LUIS ALBERTO",
      "dia_semana": "JUEVES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "HIGIENE INDUSTRIAL - 4A II",
      "docente": "MORALES PERRAZO LUIS ALBERTO",
      "dia_semana": "JUEVES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "DISEÑO Y ORGANIZACIÓN DE PLANTAS - 2A IT",
      "docente": "NARANJO CHIRIBOGA ISRAEL ERNESTO",
      "dia_semana": "JUEVES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "DISEÑO Y ORGANIZACIÓN DE PLANTAS - 2A IT",
      "docente": "NARANJO CHIRIBOGA ISRAEL ERNESTO",
      "dia_semana": "JUEVES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "DISEÑO Y ORGANIZACIÓN DE PLANTAS - 8A SW",
      "docente": "NARANJO CHIRIBOGA ISRAEL ERNESTO",
      "dia_semana": "JUEVES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "ESTADÍSTICA Y PROBABILIDAD - 3A II",
      "docente": "ALDÁS SALAZAR DARWIN SANTIAGO",
      "dia_semana": "VIERNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 2A II",
      "docente": "REYES VASQUEZ JOHN PAUL",
      "dia_semana": "VIERNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 2A II",
      "docente": "REYES VASQUEZ JOHN PAUL",
      "dia_semana": "VIERNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. AUTOMATIZACIÓN INDUSTRIAL",
      "nombre_curso": "CONTROL NEUMÁTICO E HIDRAÚLICO - 8A II",
      "docente": "ESCOBAR NARANJO JUAN CAMILO",
      "dia_semana": "MARTES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. AUTOMATIZACIÓN INDUSTRIAL",
      "nombre_curso": "CONTROL NEUMÁTICO Y OLEOHIDRÁULICA - 6A II",
      "docente": "MARIÑO RIVERA CHRISTIAN JOSÉ",
      "dia_semana": "VIERNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. AUTOMATIZACIÓN INDUSTRIAL",
      "nombre_curso": "CONTROL NEUMÁTICO Y OLEOHIDRÁULICA - 6A II",
      "docente": "MARIÑO RIVERA CHRISTIAN JOSÉ",
      "dia_semana": "VIERNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA AVANZADA",
      "nombre_curso": "CIRCUITOS RF - 7A IT",
      "docente": "GORDÓN GALLEGOS CARLOS DIEGO",
      "dia_semana": "MARTES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA AVANZADA",
      "nombre_curso": "CIRCUITOS RF - 7A IT",
      "docente": "GORDÓN GALLEGOS CARLOS DIEGO",
      "dia_semana": "MARTES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA AVANZADA",
      "nombre_curso": "SOFTWARE DE SIMULACIÓN - 7A IT",
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH",
      "dia_semana": "MARTES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA AVANZADA",
      "nombre_curso": "COMUNICACIÓN ANALÓGICA - 4B IT",
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH",
      "dia_semana": "MARTES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA AVANZADA",
      "nombre_curso": "COMUNICACIÓN ANALÓGICA - 4B IT",
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH",
      "dia_semana": "MARTES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA AVANZADA",
      "nombre_curso": "SISTEMAS DIGITALES - 8A IT",
      "docente": "GORDÓN GALLEGOS CARLOS DIEGO",
      "dia_semana": "MARTES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA AVANZADA",
      "nombre_curso": "SISTEMAS DIGITALES - 8A IT",
      "docente": "GORDÓN GALLEGOS CARLOS DIEGO",
      "dia_semana": "MARTES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA AVANZADA",
      "nombre_curso": "SISTEMAS EMBEBIDOS (VLSI) - 7A IT",
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH",
      "dia_semana": "MIERCOLES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA AVANZADA",
      "nombre_curso": "SISTEMAS EMBEBIDOS (VLSI) - 7A IT",
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH",
      "dia_semana": "MIERCOLES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA AVANZADA",
      "nombre_curso": "SISTEMAS DE CONTROL - 7A IT",
      "docente": "ENCALADA RUIZ PATRICIO GERMÁN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA AVANZADA",
      "nombre_curso": "SISTEMAS DE CONTROL - 7A IT",
      "docente": "ENCALADA RUIZ PATRICIO GERMÁN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA AVANZADA",
      "nombre_curso": "SISTEMAS DIGITALES - 4A IT",
      "docente": "GORDÓN GALLEGOS CARLOS DIEGO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA AVANZADA",
      "nombre_curso": "SISTEMAS DIGITALES - 4A IT",
      "docente": "GORDÓN GALLEGOS CARLOS DIEGO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA AVANZADA",
      "nombre_curso": "ELECTRÓNICA Y ELECTRICIDAD - 5B IT",
      "docente": "VARGAS GUEVARA CARLOS LUIS",
      "dia_semana": "JUEVES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA AVANZADA",
      "nombre_curso": "ELECTRÓNICA Y ELECTRICIDAD - 5B IT",
      "docente": "VARGAS GUEVARA CARLOS LUIS",
      "dia_semana": "JUEVES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA AVANZADA",
      "nombre_curso": "SISTEMAS EMBEBIDOS (VLSI) - 5A RA",
      "docente": "CORDOVA CORDOVA ÉDGAR PATRICIO",
      "dia_semana": "JUEVES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA AVANZADA",
      "nombre_curso": "SISTEMAS EMBEBIDOS (VLSI) - 5A RA",
      "docente": "CORDOVA CORDOVA ÉDGAR PATRICIO",
      "dia_semana": "JUEVES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA AVANZADA",
      "nombre_curso": "COMUNICACIONES ÓPTICAS - 5A RA",
      "docente": "GORDÓN GALLEGOS CARLOS DIEGO",
      "dia_semana": "JUEVES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA AVANZADA",
      "nombre_curso": "COMUNICACIONES ÓPTICAS - 5A RA",
      "docente": "GORDÓN GALLEGOS CARLOS DIEGO",
      "dia_semana": "JUEVES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA AVANZADA",
      "nombre_curso": "SOFTWARE DE SIMULACIÓN - 5A RA",
      "docente": "GORDÓN GALLEGOS CARLOS DIEGO",
      "dia_semana": "JUEVES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA AVANZADA",
      "nombre_curso": "SOFTWARE DE SIMULACIÓN - 5A RA",
      "docente": "GORDÓN GALLEGOS CARLOS DIEGO",
      "dia_semana": "JUEVES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA AVANZADA",
      "nombre_curso": "SISTEMAS EMBEBIDOS (VLSI) - 5B IT",
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH",
      "dia_semana": "VIERNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA AVANZADA",
      "nombre_curso": "SISTEMAS EMBEBIDOS (VLSI) - 5B IT",
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH",
      "dia_semana": "VIERNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA AVANZADA",
      "nombre_curso": "SISTEMAS DIGITALES - 4A IT",
      "docente": "GORDÓN GALLEGOS CARLOS DIEGO",
      "dia_semana": "VIERNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA AVANZADA",
      "nombre_curso": "SOFTWARE DE SIMULACIÓN - 4B IT",
      "docente": "GORDÓN GALLEGOS CARLOS DIEGO",
      "dia_semana": "VIERNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA BÁSICA",
      "nombre_curso": "SEÑALES Y SISTEMAS - 4A RA",
      "docente": "ENCALADA RUIZ PATRICIO GERMÁN",
      "dia_semana": "LUNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA BÁSICA",
      "nombre_curso": "SEÑALES Y SISTEMAS - 4A RA",
      "docente": "ENCALADA RUIZ PATRICIO GERMÁN",
      "dia_semana": "LUNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA BÁSICA",
      "nombre_curso": "DISPOSITIVOS Y MEDIDAS - 3A II",
      "docente": "POMAQUERO MORENO LUIS ALFREDO",
      "dia_semana": "MARTES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA BÁSICA",
      "nombre_curso": "ANÁLISIS DE CIRCUITOS - 3A II",
      "docente": "FLORES ASIMBAYA LUIS ANTONIO",
      "dia_semana": "MARTES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA BÁSICA",
      "nombre_curso": "ANÁLISIS DE CIRCUITOS - 3A II",
      "docente": "FLORES ASIMBAYA LUIS ANTONIO",
      "dia_semana": "MARTES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA BÁSICA",
      "nombre_curso": "CIRCUITOS ELECTRÓNICOS - 2A RA",
      "docente": "POMAQUERO MORENO LUIS ALFREDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA BÁSICA",
      "nombre_curso": "CIRCUITOS ELECTRÓNICOS - 2A RA",
      "docente": "POMAQUERO MORENO LUIS ALFREDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA BÁSICA",
      "nombre_curso": "INSTALACIONES ELÉCTRICAS - 4B IT",
      "docente": "GUAMÁN MOLINA JESÚS ISRAEL",
      "dia_semana": "MIERCOLES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA BÁSICA",
      "nombre_curso": "DISPOSITIVOS Y MEDIDAS - 5A RA",
      "docente": "SALAZAR LOGROÑO FRANKLIN WILFRIDO",
      "dia_semana": "JUEVES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA BÁSICA",
      "nombre_curso": "DISPOSITIVOS Y MEDIDAS - 5A RA",
      "docente": "ROBALINO PEÑA EDGAR FREDDY",
      "dia_semana": "JUEVES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA BÁSICA",
      "nombre_curso": "DISPOSITIVOS Y MEDIDAS - 5A RA",
      "docente": "ROBALINO PEÑA EDGAR FREDDY",
      "dia_semana": "JUEVES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LAB. ELECTRÓNICA BÁSICA",
      "nombre_curso": "INTRODUCCIÓN A LA AUTOMATIZACIÓN - 1A RA",
      "docente": "SALAZAR LOGROÑO FRANKLIN WILFRIDO",
      "dia_semana": "VIERNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LAB. INSTRUMENTACIÓN VIRTUAL",
      "nombre_curso": "SISTEMAS EMBEBIDOS (VLSI) - 5A IT",
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LAB. INSTRUMENTACIÓN VIRTUAL",
      "nombre_curso": "SISTEMAS EMBEBIDOS (VLSI) - 5B IT",
      "docente": "CORDOVA CORDOVA EDGAR PATRICIO",
      "dia_semana": "JUEVES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "LAB. INSTRUMENTACIÓN VIRTUAL",
      "nombre_curso": "SISTEMAS EMBEBIDOS (VLSI) - 5B IT",
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH",
      "dia_semana": "VIERNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LAB. INSTRUMENTACIÓN VIRTUAL",
      "nombre_curso": "SISTEMAS EMBEBIDOS (VLSI) - 5B IT",
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH",
      "dia_semana": "VIERNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LAB. MÁQUINAS ELÉCTRICAS",
      "nombre_curso": "MÁQUINAS ELÉCTRICAS - 4B II",
      "docente": "LÓPEZ FLORES XAVIER MAURICIO",
      "dia_semana": "MARTES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. MÁQUINAS ELÉCTRICAS",
      "nombre_curso": "MÁQUINAS ELÉCTRICAS - 4B II",
      "docente": "LÓPEZ FLORES XAVIER MAURICIO",
      "dia_semana": "MARTES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. MÁQUINAS ELÉCTRICAS",
      "nombre_curso": "MÁQUINAS ELÉCTRICAS - 4B II",
      "docente": "LÓPEZ FLORES XAVIER MAURICIO",
      "dia_semana": "MARTES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LAB. MÁQUINAS ELÉCTRICAS",
      "nombre_curso": "MÁQUINAS ELÉCTRICAS - 4C II",
      "docente": "LÓPEZ FLORES XAVIER MAURICIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. MÁQUINAS ELÉCTRICAS",
      "nombre_curso": "MÁQUINAS ELÉCTRICAS - 4C II",
      "docente": "LÓPEZ FLORES XAVIER MAURICIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. MÁQUINAS ELÉCTRICAS",
      "nombre_curso": "MÁQUINAS ELÉCTRICAS - 5A RA",
      "docente": "GUAMÁN MOLINA JESÚS ISRAEL",
      "dia_semana": "VIERNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LAB. MÁQUINAS ELÉCTRICAS",
      "nombre_curso": "MÁQUINAS ELÉCTRICAS - 5A RA",
      "docente": "GUAMÁN MOLINA JESÚS ISRAEL",
      "dia_semana": "VIERNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LAB. MÁQUINAS ELÉCTRICAS",
      "nombre_curso": "MÁQUINAS ELÉCTRICAS - 4C II",
      "docente": "LÓPEZ FLORES XAVIER MAURICIO",
      "dia_semana": "VIERNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LAB. MÁQUINAS ELÉCTRICAS",
      "nombre_curso": "MÁQUINAS ELÉCTRICAS - 4C II",
      "docente": "LÓPEZ FLORES XAVIER MAURICIO",
      "dia_semana": "VIERNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. PLC'S",
      "nombre_curso": "PLC'S - 8A II",
      "docente": "GARCIA SÁNCHEZ MARCELO VLADIMIR",
      "dia_semana": "MARTES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LAB. PLC'S",
      "nombre_curso": "PLC'S - 8A II",
      "docente": "GARCIA SÁNCHEZ MARCELO VLADIMIR",
      "dia_semana": "MARTES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. PLC'S",
      "nombre_curso": "PLC'S - 6A RA",
      "docente": "GARCIA SÁNCHEZ MARCELO VLADIMIR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. PLC'S",
      "nombre_curso": "PLC'S - 6A RA",
      "docente": "GARCIA SÁNCHEZ MARCELO VLADIMIR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. REDES Y FIBRA ÓPTICA",
      "nombre_curso": "INTRODUCCIÓN A REDES - 3A TI",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "MARTES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "LAB. REDES Y FIBRA ÓPTICA",
      "nombre_curso": "CONMUTACIÓN Y ENRUTAMIENTO BÁSICO - 7A TI",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "MARTES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LAB. REDES Y FIBRA ÓPTICA",
      "nombre_curso": "CONMUTACIÓN Y ENRUTAMIENTO BÁSICO - 7A TI",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "MARTES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LAB. REDES Y FIBRA ÓPTICA",
      "nombre_curso": "ADMINISTRACIÓN DE REDES - 3A SW",
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LAB. REDES Y FIBRA ÓPTICA",
      "nombre_curso": "INTRODUCCIÓN A REDES - 5A TI",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LAB. REDES Y FIBRA ÓPTICA",
      "nombre_curso": "INTRODUCCIÓN A REDES - 5A TI",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LAB. REDES Y FIBRA ÓPTICA",
      "nombre_curso": "INTRODUCCIÓN A REDES - 3B SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "JUEVES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LAB. REDES Y FIBRA ÓPTICA",
      "nombre_curso": "INTRODUCCIÓN A REDES - 3B SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "JUEVES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LAB. REDES Y FIBRA ÓPTICA",
      "nombre_curso": "SISTEMAS INALÁMBRICOS - 3B SW",
      "docente": "ROBALINO PEÑA EDGAR FREDDY",
      "dia_semana": "JUEVES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. REDES Y FIBRA ÓPTICA",
      "nombre_curso": "CONMUTACIÓN Y ENRUTAMIENTO BÁSICO - 5A TI",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "VIERNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "LAB. REDES Y FIBRA ÓPTICA",
      "nombre_curso": "CONMUTACIÓN Y ENRUTAMIENTO BÁSICO - 5A TI",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "VIERNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LAB. REDES Y FIBRA ÓPTICA",
      "nombre_curso": "REDES - 4B SW",
      "docente": "CHANGO SAILEMA WILSON GUSTAVO",
      "dia_semana": "VIERNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "LAB. REDES Y FIBRA ÓPTICA",
      "nombre_curso": "REDES - 4B SW",
      "docente": "CHANGO SAILEMA WILSON GUSTAVO",
      "dia_semana": "VIERNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. REDES Y FIBRA ÓPTICA",
      "nombre_curso": "REDES - 4A SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "VIERNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. REDES Y FIBRA ÓPTICA",
      "nombre_curso": "REDES - 4A SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "VIERNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA C01",
      "nombre_curso": "MECÁNICA BÁSICA - 1A RA",
      "docente": "CASTRO MARTIN ANA PAMELA",
      "dia_semana": "LUNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA C01",
      "nombre_curso": "CÁLCULO I - 1A RA",
      "docente": "CASTRO MAYORGA MARITZA ELIZABETH",
      "dia_semana": "LUNES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA C01",
      "nombre_curso": "CÁLCULO I - 1A RA",
      "docente": "CASTRO MAYORGA MARITZA ELIZABETH",
      "dia_semana": "LUNES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA C01",
      "nombre_curso": "GESTIÓN AMBIENTAL - 2A RA",
      "docente": "UREÑA AGUIRRE JEANETTE DEL PILAR",
      "dia_semana": "LUNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "AULA C01",
      "nombre_curso": "GESTIÓN AMBIENTAL - 2A RA",
      "docente": "UREÑA AGUIRRE JEANETTE DEL PILAR",
      "dia_semana": "LUNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA C01",
      "nombre_curso": "FÍSICA APLICADA - 2A RA",
      "docente": "CONTRERAS ROCHA CHRISTIAN JHONNY",
      "dia_semana": "LUNES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA C01",
      "nombre_curso": "FÍSICA APLICADA - 2A RA",
      "docente": "CONTRERAS ROCHA CHRISTIAN JHONNY",
      "dia_semana": "LUNES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "AULA C01",
      "nombre_curso": "MECÁNICA BÁSICA - 1A RA",
      "docente": "CASTRO MARTIN ANA PAMELA",
      "dia_semana": "MIERCOLES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA C01",
      "nombre_curso": "MECÁNICA BÁSICA - 1A RA",
      "docente": "CASTRO MARTIN ANA PAMELA",
      "dia_semana": "MIERCOLES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA C01",
      "nombre_curso": "CÁLCULO I - 1A RA",
      "docente": "CASTRO MAYORGA MARITZA ELIZABETH",
      "dia_semana": "MIERCOLES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA C01",
      "nombre_curso": "FÍSICA APLICADA - 2A RA",
      "docente": "CONTRERAS ROCHA CHRISTIAN JHONNY",
      "dia_semana": "MIERCOLES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA C01",
      "nombre_curso": "FÍSICA APLICADA - 2A RA",
      "docente": "CONTRERAS ROCHA CHRISTIAN JHONNY",
      "dia_semana": "MIERCOLES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA C01",
      "nombre_curso": "CÁLCULO II - 2A RA",
      "docente": "SALAZAR ESCOBAR FABIAN RODRIGO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA C01",
      "nombre_curso": "CÁLCULO II - 2A RA",
      "docente": "SALAZAR ESCOBAR FABIAN RODRIGO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "AULA C01",
      "nombre_curso": "ÁLGEBRA LINEAL - 1A RA",
      "docente": "CASTRO MAYORGA MARITZA ELIZABETH",
      "dia_semana": "JUEVES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA C01",
      "nombre_curso": "ÁLGEBRA LINEAL - 1A RA",
      "docente": "CASTRO MAYORGA MARITZA ELIZABETH",
      "dia_semana": "JUEVES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA C01",
      "nombre_curso": "DISPOSITIVOS Y MEDIDAS - 2A RA",
      "docente": "POMAQUERO MORENO LUIS ALFREDO",
      "dia_semana": "JUEVES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "AULA C01",
      "nombre_curso": "DISPOSITIVOS Y MEDIDAS - 2A RA",
      "docente": "POMAQUERO MORENO LUIS ALFREDO",
      "dia_semana": "JUEVES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA C01",
      "nombre_curso": "DISPOSITIVOS Y MEDIDAS - 2A RA",
      "docente": "POMAQUERO MORENO LUIS ALFREDO",
      "dia_semana": "JUEVES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA C01",
      "nombre_curso": "CÁLCULO II - 2A RA",
      "docente": "SALAZAR ESCOBAR FABIAN RODRIGO",
      "dia_semana": "JUEVES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA C01",
      "nombre_curso": "FÍSICA APLICADA - 2A RA",
      "docente": "CONTRERAS ROCHA CHRISTIAN JHONNY",
      "dia_semana": "JUEVES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA C01",
      "nombre_curso": "ESTÁTICA Y DINÁMICA - 2A RA",
      "docente": "CONTRERAS ROCHA CHRISTIAN JHONNY",
      "dia_semana": "VIERNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "AULA C01",
      "nombre_curso": "ESTÁTICA Y DINÁMICA - 2A RA",
      "docente": "CONTRERAS ROCHA CHRISTIAN JHONNY",
      "dia_semana": "VIERNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA C01",
      "nombre_curso": "GESTIÓN AMBIENTAL - 2A RA",
      "docente": "UREÑA AGUIRRE JEANETTE DEL PILAR",
      "dia_semana": "VIERNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA F01",
      "nombre_curso": "MÉTODOS NUMÉRICOS - 3A RA",
      "docente": "CONTRERAS ROCHA CHRISTIAN JHONNY",
      "dia_semana": "LUNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA F01",
      "nombre_curso": "ECUACIONES DIFERENCIALES - 3A RA",
      "docente": "GUILCAPI MOSQUERA JAIME RODRIGO",
      "dia_semana": "LUNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA F01",
      "nombre_curso": "ECUACIONES DIFERENCIALES - 3A RA",
      "docente": "GUILCAPI MOSQUERA JAIME RODRIGO",
      "dia_semana": "LUNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA F01",
      "nombre_curso": "INSTALACIONES ELÉCTRICAS - 4A RA",
      "docente": "GUAMÁN MOLINA JESUS ISRAEL",
      "dia_semana": "LUNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA F01",
      "nombre_curso": "INSTALACIONES ELÉCTRICAS - 4A RA",
      "docente": "GUAMÁN MOLINA JESUS ISRAEL",
      "dia_semana": "LUNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA F01",
      "nombre_curso": "TEORÍA ELECTROMAGNÉTICA - 4A RA",
      "docente": "POMAQUERO MORENO LUIS ALFREDO",
      "dia_semana": "LUNES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA F01",
      "nombre_curso": "TEORÍA ELECTROMAGNÉTICA - 4A RA",
      "docente": "POMAQUERO MORENO LUIS ALFREDO",
      "dia_semana": "LUNES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "AULA F01",
      "nombre_curso": "ECUACIONES DIFERENCIALES - 3A RA",
      "docente": "GUILCAPI MOSQUERA JAIME RODRIGO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA F01",
      "nombre_curso": "MÉTODOS NUMÉRICOS - 3A RA",
      "docente": "CONTRERAS ROCHA CHRISTIAN JHONNY",
      "dia_semana": "MIERCOLES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA F01",
      "nombre_curso": "MÉTODOS NUMÉRICOS - 3A RA",
      "docente": "CONTRERAS ROCHA CHRISTIAN JHONNY",
      "dia_semana": "MIERCOLES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA F01",
      "nombre_curso": "MECANISMOS - 4A RA",
      "docente": "ESCOBAR NARANJO JUAN CAMILO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA F01",
      "nombre_curso": "MECANISMOS - 4A RA",
      "docente": "ESCOBAR NARANJO JUAN CAMILO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA F01",
      "nombre_curso": "PROBABILIDAD Y ESTADÍSTICA - 3A RA",
      "docente": "GUILCAPI MOSQUERA JAIME RODRIGO",
      "dia_semana": "JUEVES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA F01",
      "nombre_curso": "CIRCUITOS ELÉCTRICOS - 3A RA",
      "docente": "GUAMÁN MOLINA JESUS ISRAEL",
      "dia_semana": "JUEVES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA F01",
      "nombre_curso": "CIRCUITOS ELÉCTRICOS - 3A RA",
      "docente": "GUAMÁN MOLINA JESUS ISRAEL",
      "dia_semana": "JUEVES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA F01",
      "nombre_curso": "GESTIÓN DE CALIDAD - 4A RA",
      "docente": "UREÑA AGUIRRE JEANETTE DEL PILAR",
      "dia_semana": "JUEVES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "AULA F01",
      "nombre_curso": "MECANISMOS - 4A RA",
      "docente": "ESCOBAR NARANJO JUAN CAMILO",
      "dia_semana": "JUEVES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA F01",
      "nombre_curso": "MECANISMOS - 4A RA",
      "docente": "ESCOBAR NARANJO JUAN CAMILO",
      "dia_semana": "JUEVES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA F01",
      "nombre_curso": "SEÑALES Y SISTEMAS - 4A RA",
      "docente": "ENCALADA RUIZ PATRICIO GERMÁN",
      "dia_semana": "JUEVES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA F01",
      "nombre_curso": "SEÑALES Y SISTEMAS - 4A RA",
      "docente": "ENCALADA RUIZ PATRICIO GERMÁN",
      "dia_semana": "JUEVES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA F01",
      "nombre_curso": "MÉTODOS NUMÉRICOS - 3A RA",
      "docente": "CONTRERAS ROCHA CHRISTIAN JHONNY",
      "dia_semana": "VIERNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA F01",
      "nombre_curso": "SEGURIDAD INDUSTRIAL - 3A RA",
      "docente": "UREÑA AGUIRRE JEANETTE DEL PILAR",
      "dia_semana": "VIERNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA F01",
      "nombre_curso": "TEORÍA ELECTROMAGNÉTICA - 4A RA",
      "docente": "POMAQUERO MORENO LUIS ALFREDO",
      "dia_semana": "VIERNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "AULA F01",
      "nombre_curso": "TEORÍA ELECTROMAGNÉTICA - 4A RA",
      "docente": "POMAQUERO MORENO LUIS ALFREDO",
      "dia_semana": "VIERNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA F01",
      "nombre_curso": "SEÑALES Y SISTEMAS - 4A RA",
      "docente": "ENCALADA RUIZ PATRICIO GERMÁN",
      "dia_semana": "VIERNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA F02",
      "nombre_curso": "CÁLCULO DE UNA VARIABLE - 1B IT",
      "docente": "SALAZAR ESCOBAR FABIAN RODRIGO",
      "dia_semana": "MARTES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA F02",
      "nombre_curso": "ÁLGEBRA LINEAL - 1B IT",
      "docente": "ZAMBRANO VALVERDE TATIANA PAOLA",
      "dia_semana": "MARTES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA F02",
      "nombre_curso": "ÁLGEBRA LINEAL - 1B IT",
      "docente": "ZAMBRANO VALVERDE TATIANA PAOLA",
      "dia_semana": "MARTES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA F02",
      "nombre_curso": "EVOLUCIÓN DE LAS TELECOMUNICACIONES - 1B IT",
      "docente": "FLORES ASIMBAYA LUIS ANTONIO",
      "dia_semana": "MARTES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA F02",
      "nombre_curso": "EVOLUCIÓN DE LAS TELECOMUNICACIONES - 1B IT",
      "docente": "FLORES ASIMBAYA LUIS ANTONIO",
      "dia_semana": "MARTES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA F02",
      "nombre_curso": "CÁLCULO DE VARIAS VARIABLES - 2A IT",
      "docente": "ZAMBRANO VALVERDE TATIANA PAOLA",
      "dia_semana": "MARTES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA F02",
      "nombre_curso": "CÁLCULO DE VARIAS VARIABLES - 2A IT",
      "docente": "ZAMBRANO VALVERDE TATIANA PAOLA",
      "dia_semana": "MARTES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA F02",
      "nombre_curso": "FÍSICA BÁSICA - 1B IT",
      "docente": "CONTRERAS ROCHA CHRISTIAN JHONNY",
      "dia_semana": "MIERCOLES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA F02",
      "nombre_curso": "ÁLGEBRA LINEAL - 1B IT",
      "docente": "ZAMBRANO VALVERDE TATIANA PAOLA",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA F02",
      "nombre_curso": "ÁLGEBRA LINEAL - 1B IT",
      "docente": "ZAMBRANO VALVERDE TATIANA PAOLA",
      "dia_semana": "MIERCOLES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA F02",
      "nombre_curso": "FÍSICA APLICADA - 2A IT",
      "docente": "BENALCAZAR PALACIOS FREDDY GEOVANNY",
      "dia_semana": "MIERCOLES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "AULA F02",
      "nombre_curso": "FÍSICA APLICADA - 2A IT",
      "docente": "BENALCAZAR PALACIOS FREDDY GEOVANNY",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA F02",
      "nombre_curso": "EVOLUCIÓN DE LAS TELECOMUNICACIONES - 2A IT",
      "docente": "FLORES ASIMBAYA LUIS ANTONIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA F02",
      "nombre_curso": "EVOLUCIÓN DE LAS TELECOMUNICACIONES - 2A IT",
      "docente": "FLORES ASIMBAYA LUIS ANTONIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "AULA F02",
      "nombre_curso": "QUÍMICA - 1B IT",
      "docente": "SEVILLA ABARCA MARTHA ESPERANZA",
      "dia_semana": "JUEVES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA F02",
      "nombre_curso": "CÁLCULO DE UNA VARIABLE - 1B IT",
      "docente": "SALAZAR ESCOBAR FABIAN RODRIGO",
      "dia_semana": "JUEVES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA F02",
      "nombre_curso": "CÁLCULO DE UNA VARIABLE - 1B IT",
      "docente": "SALAZAR ESCOBAR FABIAN RODRIGO",
      "dia_semana": "JUEVES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA F02",
      "nombre_curso": "GESTIÓN DE CALIDAD - 2A IT",
      "docente": "SEVILLA ABARCA MARTHA ESPERANZA",
      "dia_semana": "JUEVES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "AULA F02",
      "nombre_curso": "FÍSICA APLICADA - 2A IT",
      "docente": "BENALCAZAR PALACIOS FREDDY GEOVANNY",
      "dia_semana": "JUEVES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA F02",
      "nombre_curso": "CÁLCULO DE VARIAS VARIABLES - 2A IT",
      "docente": "ZAMBRANO VALVERDE TATIANA PAOLA",
      "dia_semana": "JUEVES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA F02",
      "nombre_curso": "CÁLCULO DE VARIAS VARIABLES - 2A IT",
      "docente": "ZAMBRANO VALVERDE TATIANA PAOLA",
      "dia_semana": "JUEVES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "INVESTIGACIÓN OPERATIVA - 5A SW",
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR",
      "dia_semana": "LUNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "INVESTIGACIÓN OPERATIVA - 5A SW",
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR",
      "dia_semana": "LUNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "INVESTIGACIÓN OPERATIVA - 5A SW",
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR",
      "dia_semana": "LUNES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "PROCESAMIENTO DIGITAL DE SEÑALES - 5A SW",
      "docente": "ALTAMIRANO MELÉNDEZ SANTIAGO MAURICIO",
      "dia_semana": "LUNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "PROCESAMIENTO DIGITAL DE SEÑALES - 5A SW",
      "docente": "ALTAMIRANO MELÉNDEZ SANTIAGO MAURICIO",
      "dia_semana": "LUNES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "COMUNICACIÓN ANALÓGICA - 5A SW",
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH",
      "dia_semana": "LUNES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "COMUNICACIÓN ANALÓGICA - 5A SW",
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH",
      "dia_semana": "LUNES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "LÍNEAS DE TRANSMISIÓN - 5A TI",
      "docente": "CUJI RODRIGUEZ JULIO ENRIQUE",
      "dia_semana": "MARTES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "LÍNEAS DE TRANSMISIÓN - 5A TI",
      "docente": "CUJI RODRIGUEZ JULIO ENRIQUE",
      "dia_semana": "MARTES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "PROCESAMIENTO DIGITAL DE SEÑALES - 6A IT",
      "docente": "ALTAMIRANO MELÉNDEZ SANTIAGO MAURICIO",
      "dia_semana": "MARTES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "PROCESAMIENTO DIGITAL DE SEÑALES - 6A IT",
      "docente": "ALTAMIRANO MELÉNDEZ SANTIAGO MAURICIO",
      "dia_semana": "MARTES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "PROPAGACIÓN Y ANTENAS - 7A IT",
      "docente": "CUJI RODRIGUEZ JULIO ENRIQUE",
      "dia_semana": "MIERCOLES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "PROPAGACIÓN Y ANTENAS - 7A IT",
      "docente": "CUJI RODRIGUEZ JULIO ENRIQUE",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "PROCESAMIENTO DIGITAL DE SEÑALES - 6A IT",
      "docente": "ALTAMIRANO MELÉNDEZ SANTIAGO MAURICIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "PROCESAMIENTO DIGITAL DE SEÑALES - 6A IT",
      "docente": "ALTAMIRANO MELÉNDEZ SANTIAGO MAURICIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "PROYECTOS DE TELECOMUNICACIONES - 6A IT",
      "docente": "ZAMBRANO VALVERDE TATIANA PAOLA",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "PROYECTOS DE TELECOMUNICACIONES - 6A IT",
      "docente": "ZAMBRANO VALVERDE TATIANA PAOLA",
      "dia_semana": "MIERCOLES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "PROPAGACIÓN Y ANTENAS - 7A IT",
      "docente": "CUJI RODRIGUEZ JULIO ENRIQUE",
      "dia_semana": "JUEVES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "COMUNICACIÓN DIGITAL - 7A IT",
      "docente": "FLORES ASIMBAYA LUIS ANTONIO",
      "dia_semana": "JUEVES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "COMUNICACIÓN DIGITAL - 7A IT",
      "docente": "FLORES ASIMBAYA LUIS ANTONIO",
      "dia_semana": "JUEVES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "COMUNICACIÓN DIGITAL - 7A IT",
      "docente": "FLORES ASIMBAYA LUIS ANTONIO",
      "dia_semana": "JUEVES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "PROYECTOS DE TELECOMUNICACIONES - 7A IT",
      "docente": "ZAMBRANO VALVERDE TATIANA PAOLA",
      "dia_semana": "JUEVES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "PROYECTOS DE TELECOMUNICACIONES - 7A IT",
      "docente": "ZAMBRANO VALVERDE TATIANA PAOLA",
      "dia_semana": "JUEVES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "LÍNEAS DE TRANSMISIÓN - 6A IT",
      "docente": "CUJI RODRIGUEZ JULIO ENRIQUE",
      "dia_semana": "JUEVES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "LÍNEAS DE TRANSMISIÓN - 6A IT",
      "docente": "CUJI RODRIGUEZ JULIO ENRIQUE",
      "dia_semana": "JUEVES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "INVESTIGACIÓN OPERATIVA - 5B SW",
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR",
      "dia_semana": "VIERNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "SISTEMAS DE TELEFONÍA - 6A IT",
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO",
      "dia_semana": "VIERNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "SISTEMAS DE TELEFONÍA - 6A IT",
      "docente": "MINIGUANO MINIGUANO LIVIO DANILO",
      "dia_semana": "VIERNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "COMUNICACIÓN ANALÓGICA - 6A IT",
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH",
      "dia_semana": "VIERNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "CIRCUITOS ELECTRÓNICOS - 5A IT",
      "docente": "GARCIA CARRILLO MARIO GEOVANNI",
      "dia_semana": "MARTES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "CIRCUITOS ELECTRÓNICOS - 5A IT",
      "docente": "GARCIA CARRILLO MARIO GEOVANNI",
      "dia_semana": "MARTES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "REALIDAD NACIONAL - 5A IT",
      "docente": "ALTAMIRANO MELÉNDEZ SANTIAGO MAURICIO",
      "dia_semana": "MARTES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "REALIDAD NACIONAL - 5A IT",
      "docente": "ALTAMIRANO MELÉNDEZ SANTIAGO MAURICIO",
      "dia_semana": "MARTES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "SISTEMAS INALÁMBRICOS - 8A IT",
      "docente": "ROBALINO PEÑA EDGAR FREDDY",
      "dia_semana": "MARTES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "SISTEMAS INALÁMBRICOS - 8A IT",
      "docente": "ROBALINO PEÑA EDGAR FREDDY",
      "dia_semana": "MARTES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "DISEÑO DE PROYECTOS - 8A IT",
      "docente": "CASTRO MARTIN ANA PAMELA",
      "dia_semana": "MARTES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "DISEÑO DE PROYECTOS - 8A IT",
      "docente": "CASTRO MARTIN ANA PAMELA",
      "dia_semana": "MARTES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "COMUNICACIONES MÓVILES - 8A IT",
      "docente": "CORDOVA CORDOVA EDGAR PATRICIO",
      "dia_semana": "MARTES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "COMUNICACIONES MÓVILES - 8A IT",
      "docente": "CORDOVA CORDOVA EDGAR PATRICIO",
      "dia_semana": "MARTES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "SISTEMAS EMBEBIDOS (VLSI) - 5A IT",
      "docente": "CORDOVA CORDOVA EDGAR PATRICIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "SISTEMAS EMBEBIDOS (VLSI) - 5A IT",
      "docente": "CORDOVA CORDOVA EDGAR PATRICIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "PROCESOS ESTOCASTICOS - 5A IT",
      "docente": "CASTRO MARTIN ANA PAMELA",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "PROCESOS ESTOCASTICOS - 5A IT",
      "docente": "CASTRO MARTIN ANA PAMELA",
      "dia_semana": "MIERCOLES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "SISTEMAS SATELITALES Y GPS - 8A IT",
      "docente": "FLORES ASIMBAYA LUIS ANTONIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "SISTEMAS SATELITALES Y GPS - 8A IT",
      "docente": "FLORES ASIMBAYA LUIS ANTONIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "COMUNICACIONES AVANZADAS - 8A IT",
      "docente": "ZAMBRANO VALVERDE TATIANA PAOLA",
      "dia_semana": "MIERCOLES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "COMUNICACIONES AVANZADAS - 8A IT",
      "docente": "ZAMBRANO VALVERDE TATIANA PAOLA",
      "dia_semana": "MIERCOLES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "TELEVISIÓN DIGITAL - 8A IT",
      "docente": "ALTAMIRANO MELÉNDEZ SANTIAGO MAURICIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "TELEVISIÓN DIGITAL - 8A IT",
      "docente": "ALTAMIRANO MELÉNDEZ SANTIAGO MAURICIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "REALIDAD NACIONAL - 5A IT",
      "docente": "ALTAMIRANO MELÉNDEZ SANTIAGO MAURICIO",
      "dia_semana": "JUEVES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "CIRCUITOS ELECTRÓNICOS - 5A IT",
      "docente": "GARCIA CARRILLO MARIO GEOVANNI",
      "dia_semana": "JUEVES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "CIRCUITOS ELECTRÓNICOS - 5A IT",
      "docente": "GARCIA CARRILLO MARIO GEOVANNI",
      "dia_semana": "JUEVES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "SISTEMAS EMBEBIDOS (VLSI) - 5A IT",
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH",
      "dia_semana": "JUEVES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "SISTEMAS EMBEBIDOS (VLSI) - 5A IT",
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH",
      "dia_semana": "JUEVES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "SISTEMAS INALÁMBRICOS - 8A IT",
      "docente": "ROBALINO PEÑA EDGAR FREDDY",
      "dia_semana": "JUEVES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "SISTEMAS INALÁMBRICOS - 8A IT",
      "docente": "ROBALINO PEÑA EDGAR FREDDY",
      "dia_semana": "JUEVES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "COMUNICACIONES MÓVILES - 8A IT",
      "docente": "CORDOVA CORDOVA EDGAR PATRICIO",
      "dia_semana": "JUEVES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "PROCESOS ESTOCASTICOS - 5A IT",
      "docente": "CASTRO MARTIN ANA PAMELA",
      "dia_semana": "VIERNES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "TELEVISIÓN DIGITAL - 8A IT",
      "docente": "ALTAMIRANO MELÉNDEZ SANTIAGO MAURICIO",
      "dia_semana": "VIERNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "DISEÑO DE PROYECTOS - 8A IT",
      "docente": "CASTRO MARTIN ANA PAMELA",
      "dia_semana": "VIERNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA F04",
      "nombre_curso": "DISEÑO DE PROYECTOS - 8A IT",
      "docente": "CASTRO MARTIN ANA PAMELA",
      "dia_semana": "VIERNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA F08",
      "nombre_curso": "FÍSICA PARA ELECTRÓNICA - 3A IT",
      "docente": "BENALCAZAR PALACIOS FREDDY GEOVANNY",
      "dia_semana": "MARTES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA F08",
      "nombre_curso": "PROBABILIDAD Y ESTADÍSTICA - 3A IT",
      "docente": "GUILCAPI MOSQUERA JAIME RODRIGO",
      "dia_semana": "MARTES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA F08",
      "nombre_curso": "PROBABILIDAD Y ESTADÍSTICA - 3A IT",
      "docente": "GUILCAPI MOSQUERA JAIME RODRIGO",
      "dia_semana": "MARTES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA F08",
      "nombre_curso": "ANÁLISIS DE CIRCUITOS - 4A IT",
      "docente": "GARCIA CARRILLO MARIO GEOVANNI",
      "dia_semana": "MARTES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA F08",
      "nombre_curso": "ANÁLISIS DE CIRCUITOS - 4A IT",
      "docente": "GARCIA CARRILLO MARIO GEOVANNI",
      "dia_semana": "MARTES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA F08",
      "nombre_curso": "MÉTODOS NUMÉRICOS - 3A IT",
      "docente": "SÁNCHEZ BENÍTEZ CLARA AUGUSTA",
      "dia_semana": "MIERCOLES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA F08",
      "nombre_curso": "DISPOSITIVOS Y MEDIDAS - 3A IT",
      "docente": "ROBALINO PEÑA EDGAR FREDDY",
      "dia_semana": "MIERCOLES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA F08",
      "nombre_curso": "DISPOSITIVOS Y MEDIDAS - 3A IT",
      "docente": "ROBALINO PEÑA EDGAR FREDDY",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA F08",
      "nombre_curso": "ECUACIONES DIFERENCIALES - 3A IT",
      "docente": "GUILCAPI MOSQUERA JAIME RODRIGO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA F08",
      "nombre_curso": "ECUACIONES DIFERENCIALES - 3A IT",
      "docente": "GUILCAPI MOSQUERA JAIME RODRIGO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA F08",
      "nombre_curso": "SISTEMAS LINEALES - 3A IT",
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA F08",
      "nombre_curso": "SISTEMAS LINEALES - 3A IT",
      "docente": "VALENCIA VARGAS SUSANA ELIZABETH",
      "dia_semana": "MIERCOLES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA F08",
      "nombre_curso": "PROBABILIDAD Y ESTADÍSTICA - 3A IT",
      "docente": "GUILCAPI MOSQUERA JAIME RODRIGO",
      "dia_semana": "JUEVES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA F08",
      "nombre_curso": "PROBABILIDAD Y ESTADÍSTICA - 3A IT",
      "docente": "GUILCAPI MOSQUERA JAIME RODRIGO",
      "dia_semana": "JUEVES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA F08",
      "nombre_curso": "ANÁLISIS DE CIRCUITOS - 4A IT",
      "docente": "GARCIA CARRILLO MARIO GEOVANNI",
      "dia_semana": "JUEVES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA F08",
      "nombre_curso": "ANÁLISIS DE CIRCUITOS - 4A IT",
      "docente": "GARCIA CARRILLO MARIO GEOVANNI",
      "dia_semana": "JUEVES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA F08",
      "nombre_curso": "FÍSICA PARA ELECTRÓNICA - 3A IT",
      "docente": "BENALCAZAR PALACIOS FREDDY GEOVANNY",
      "dia_semana": "VIERNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA F08",
      "nombre_curso": "ECUACIONES DIFERENCIALES - 3A IT",
      "docente": "GUILCAPI MOSQUERA JAIME RODRIGO",
      "dia_semana": "VIERNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA F08",
      "nombre_curso": "ÁLGEBRA LINEAL - 2B II",
      "docente": "MORALES OÑATE BOLÍVAR EFRAÍN",
      "dia_semana": "VIERNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA F08",
      "nombre_curso": "FÍSICA APLICADA - 2B II",
      "docente": "URRUTIA URRUTIA FERNANDO",
      "dia_semana": "VIERNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "ERGONOMÍA - 3A II",
      "docente": "URRUTIA URRUTIA FERNANDO",
      "dia_semana": "MARTES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "MÁQUINAS HERRAMIENTAS - 3A II",
      "docente": "MARIÑO RIVERA CHRISTIAN JOSÉ",
      "dia_semana": "MARTES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "ADMINISTRACIÓN DE LA PRODUCCIÓN - 3A II",
      "docente": "REYES VASQUEZ JOHN PAUL",
      "dia_semana": "MARTES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "ADMINISTRACIÓN DE LA PRODUCCIÓN - 3A II",
      "docente": "REYES VASQUEZ JOHN PAUL",
      "dia_semana": "MARTES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "ADMINISTRACIÓN DE LA PRODUCCIÓN - 3A II",
      "docente": "REYES VASQUEZ JOHN PAUL",
      "dia_semana": "MARTES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "OPERACIONES UNITARIAS - 4A II",
      "docente": "ORTIZ GUERRERO DAYSI MARGARITA",
      "dia_semana": "MARTES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "SEGURIDAD INDUSTRIAL - 4A II",
      "docente": "TIGRE ORTEGA FRANKLIN GEOVANNY",
      "dia_semana": "MARTES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "SEGURIDAD INDUSTRIAL - 4A II",
      "docente": "TIGRE ORTEGA FRANKLIN GEOVANNY",
      "dia_semana": "MARTES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "ELECTRÓNICA Y ELECTRICIDAD - 5A II",
      "docente": "VARGAS GUEVARA CARLOS LUIS",
      "dia_semana": "MIERCOLES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "INVESTIGACIÓN DE OPERACIONES - 5A II",
      "docente": "NARANJO CHIRIBOGA ISRAEL ERNESTO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "INVESTIGACIÓN DE OPERACIONES - 5A II",
      "docente": "NARANJO CHIRIBOGA ISRAEL ERNESTO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "TERMODINÁMICA - 5A II",
      "docente": "LEMA CHICAIZA FREDDY ROBERTO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "TERMODINÁMICA - 5A II",
      "docente": "LEMA CHICAIZA FREDDY ROBERTO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "SEGURIDAD INDUSTRIAL - 4A II",
      "docente": "TIGRE ORTEGA FRANKLIN GEOVANNY",
      "dia_semana": "MIERCOLES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "INGENIERÍA DE MÉTODOS - 4A II",
      "docente": "SÁNCHEZ ROSERO CARLOS HUMBERTO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "INGENIERÍA DE MÉTODOS - 4A II",
      "docente": "SÁNCHEZ ROSERO CARLOS HUMBERTO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "CONTABILIDAD Y COSTOS INDUSTRIALES - 4A II",
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA",
      "dia_semana": "MIERCOLES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "INVESTIGACIÓN DE OPERACIONES - 3A II",
      "docente": "NARANJO CHIRIBOGA ISRAEL ERNESTO",
      "dia_semana": "JUEVES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "INVESTIGACIÓN DE OPERACIONES - 3A II",
      "docente": "NARANJO CHIRIBOGA ISRAEL ERNESTO",
      "dia_semana": "JUEVES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "CÁLCULO INTEGRAL - 3A II",
      "docente": "MORALES OÑATE BOLÍVAR EFRAÍN",
      "dia_semana": "JUEVES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "CÁLCULO INTEGRAL - 3A II",
      "docente": "MORALES OÑATE BOLÍVAR EFRAÍN",
      "dia_semana": "JUEVES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "OPERACIONES UNITARIAS - 4A II",
      "docente": "ORTIZ GUERRERO DAYSI MARGARITA",
      "dia_semana": "JUEVES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "OPERACIONES UNITARIAS - 4A II",
      "docente": "ORTIZ GUERRERO DAYSI MARGARITA",
      "dia_semana": "JUEVES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "TECNOLOGÍA DE LOS MATERIALES - 3A II",
      "docente": "MARIÑO RIVERA CHRISTIAN JOSÉ",
      "dia_semana": "VIERNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "TECNOLOGÍA DE LOS MATERIALES - 3B II",
      "docente": "MARIÑO RIVERA CHRISTIAN JOSÉ",
      "dia_semana": "VIERNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "CONTABILIDAD Y COSTOS INDUSTRIALES - 4A II",
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA",
      "dia_semana": "VIERNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "CONTABILIDAD Y COSTOS INDUSTRIALES - 4A II",
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA",
      "dia_semana": "VIERNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "INGENIERÍA DE MÉTODOS - 4A II",
      "docente": "SÁNCHEZ ROSERO CARLOS HUMBERTO",
      "dia_semana": "VIERNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA G02",
      "nombre_curso": "INGENIERÍA DE MÉTODOS - 4B II",
      "docente": "SÁNCHEZ ROSERO CARLOS HUMBERTO",
      "dia_semana": "VIERNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA G03",
      "nombre_curso": "DISEÑO DE PROYECTOS - 8A II",
      "docente": "ORTIZ GUERRERO DAYSI MARGARITA",
      "dia_semana": "MARTES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA G03",
      "nombre_curso": "LOGÍSTICA Y CADENA DE ABASTECIMIENTO - 8A II",
      "docente": "NARANJO CHIRIBOGA ISRAEL ERNESTO",
      "dia_semana": "MARTES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA G03",
      "nombre_curso": "LOGÍSTICA Y CADENA DE ABASTECIMIENTO - 8A II",
      "docente": "NARANJO CHIRIBOGA ISRAEL ERNESTO",
      "dia_semana": "MARTES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "AULA G03",
      "nombre_curso": "LOGÍSTICA Y CADENA DE ABASTECIMIENTO - 8A II",
      "docente": "NARANJO CHIRIBOGA ISRAEL ERNESTO",
      "dia_semana": "MARTES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "AULA G03",
      "nombre_curso": "EMPRENDIMIENTO E INNOVACIÓN - 7A II",
      "docente": "LÓPEZ ARBOLEDA JESSICA PAOLA",
      "dia_semana": "MIERCOLES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA G03",
      "nombre_curso": "CONTROL DE CALIDAD - 7A II",
      "docente": "ALDÁS SALAZAR DARWIN SANTIAGO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA G03",
      "nombre_curso": "CONTROL DE CALIDAD - 7A II",
      "docente": "ALDÁS SALAZAR DARWIN SANTIAGO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA G03",
      "nombre_curso": "GERENCIA EMPRESARIAL - 7A II",
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA G03",
      "nombre_curso": "GERENCIA EMPRESARIAL - 7A II",
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA",
      "dia_semana": "MIERCOLES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA G03",
      "nombre_curso": "GESTIÓN DEL MANTENIMIENTO - 7A II",
      "docente": "URRUTIA URRUTIA FERNANDO",
      "dia_semana": "JUEVES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA G03",
      "nombre_curso": "GESTIÓN DEL MANTENIMIENTO - 7A II",
      "docente": "URRUTIA URRUTIA FERNANDO",
      "dia_semana": "JUEVES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA G03",
      "nombre_curso": "GESTIÓN DE CALIDAD - 7A II",
      "docente": "MARIÑO RIVERA CHRISTIAN JOSÉ",
      "dia_semana": "JUEVES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA G03",
      "nombre_curso": "GESTIÓN DE CALIDAD - 7A II",
      "docente": "MARIÑO RIVERA CHRISTIAN JOSÉ",
      "dia_semana": "JUEVES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA G03",
      "nombre_curso": "DISEÑO DE PROYECTOS - 7A II",
      "docente": "ORTIZ GUERRERO DAYSI MARGARITA",
      "dia_semana": "JUEVES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "AULA G03",
      "nombre_curso": "DISEÑO DE PROYECTOS - 7A II",
      "docente": "ORTIZ GUERRERO DAYSI MARGARITA",
      "dia_semana": "JUEVES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "AULA G03",
      "nombre_curso": "CONTROL DE CALIDAD - 7A II",
      "docente": "ALDÁS SALAZAR DARWIN SANTIAGO",
      "dia_semana": "VIERNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA G03",
      "nombre_curso": "DISEÑO DE PROYECTOS - 8A II",
      "docente": "ORTIZ GUERRERO DAYSI MARGARITA",
      "dia_semana": "VIERNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "AULA G03",
      "nombre_curso": "DISEÑO DE PROYECTOS - 8A II",
      "docente": "ORTIZ GUERRERO DAYSI MARGARITA",
      "dia_semana": "VIERNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA G03",
      "nombre_curso": "DISEÑO DE PROYECTOS - 8A II",
      "docente": "ORTIZ GUERRERO DAYSI MARGARITA",
      "dia_semana": "VIERNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "LÓGICA MATEMÁTICA - 1B SW",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "LUNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "LÓGICA MATEMÁTICA - 1B SW",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "LUNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "LÓGICA MATEMÁTICA - 1B SW",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "LUNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "FÍSICA - 1B SW",
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO",
      "dia_semana": "LUNES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "FÍSICA - 1B SW",
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO",
      "dia_semana": "LUNES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "ELECTROMAGNETISMO - 1B SW",
      "docente": "CUJI RODRIGUEZ JULIO ENRIQUE",
      "dia_semana": "LUNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "ELECTROMAGNETISMO - 1B SW",
      "docente": "CUJI RODRIGUEZ JULIO ENRIQUE",
      "dia_semana": "LUNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "ANÁLISIS DE CIRCUITOS - 1B SW",
      "docente": "FLORES ASIMBAYA LUIS ANTONIO",
      "dia_semana": "LUNES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "ANÁLISIS DE CIRCUITOS - 1B SW",
      "docente": "FLORES ASIMBAYA LUIS ANTONIO",
      "dia_semana": "LUNES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "SISTEMAS LINEALES - 4A IT",
      "docente": "GARCIA CARRILLO MARIO GEOVANNI",
      "dia_semana": "MARTES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "SISTEMAS LINEALES - 4A IT",
      "docente": "GARCIA CARRILLO MARIO GEOVANNI",
      "dia_semana": "MARTES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "CÁLCULO DIFERENCIAL - 1B SW",
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "CÁLCULO DIFERENCIAL - 1B SW",
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "FÍSICA - 1B SW",
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "SISTEMAS LINEALES - 4B IT",
      "docente": "GARCIA CARRILLO MARIO GEOVANNI",
      "dia_semana": "MIERCOLES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "SISTEMAS LINEALES - 4B IT",
      "docente": "GARCIA CARRILLO MARIO GEOVANNI",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "ELECTROMAGNETISMO - 4B IT",
      "docente": "CUJI RODRIGUEZ JULIO ENRIQUE",
      "dia_semana": "MIERCOLES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "ELECTROMAGNETISMO - 4B IT",
      "docente": "CUJI RODRIGUEZ JULIO ENRIQUE",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "CÁLCULO DIFERENCIAL - 1B SW",
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN",
      "dia_semana": "JUEVES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "ÁLGEBRA LINEAL - 1B SW",
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR",
      "dia_semana": "JUEVES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "ÁLGEBRA LINEAL - 1B SW",
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR",
      "dia_semana": "JUEVES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "ELECTROMAGNETISMO - 4B IT",
      "docente": "CUJI RODRIGUEZ JULIO ENRIQUE",
      "dia_semana": "JUEVES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "ELECTROMAGNETISMO - 4B IT",
      "docente": "CUJI RODRIGUEZ JULIO ENRIQUE",
      "dia_semana": "JUEVES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "ANÁLISIS DE CIRCUITOS - 4A IT",
      "docente": "FLORES ASIMBAYA LUIS ANTONIO",
      "dia_semana": "JUEVES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "ANÁLISIS DE CIRCUITOS - 4A IT",
      "docente": "FLORES ASIMBAYA LUIS ANTONIO",
      "dia_semana": "JUEVES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "FÍSICA - 1B SW",
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO",
      "dia_semana": "VIERNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "FÍSICA - 1A TI",
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO",
      "dia_semana": "VIERNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "FÍSICA - 1A TI",
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO",
      "dia_semana": "VIERNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA H02",
      "nombre_curso": "INGENIERÍA DE MÉTODOS - 4A TI",
      "docente": "SÁNCHEZ ROSERO CARLOS HUMBERTO",
      "dia_semana": "MARTES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA H02",
      "nombre_curso": "INGENIERÍA DE MÉTODOS - 4A TI",
      "docente": "SÁNCHEZ ROSERO CARLOS HUMBERTO",
      "dia_semana": "MARTES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA H02",
      "nombre_curso": "DESARROLLO DE PROYECTOS - 3B IT",
      "docente": "LÓPEZ ARBOLEDA JESSICA PAOLA",
      "dia_semana": "JUEVES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA H02",
      "nombre_curso": "DESARROLLO DE PROYECTOS - 3B IT",
      "docente": "LÓPEZ ARBOLEDA JESSICA PAOLA",
      "dia_semana": "JUEVES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA H02",
      "nombre_curso": "INGENIERÍA DE MÉTODOS - 3B IT",
      "docente": "SÁNCHEZ ROSERO CARLOS HUMBERTO",
      "dia_semana": "JUEVES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA H02",
      "nombre_curso": "INGENIERÍA DE MÉTODOS - 3B IT",
      "docente": "SÁNCHEZ ROSERO CARLOS HUMBERTO",
      "dia_semana": "JUEVES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA H02",
      "nombre_curso": "MÉTODOS NUMÉRICOS - 3B IT",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "JUEVES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "AULA H02",
      "nombre_curso": "MÉTODOS NUMÉRICOS - 3B IT",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "JUEVES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "AULA H02",
      "nombre_curso": "DESARROLLO DE PROYECTOS - 9A II",
      "docente": "LÓPEZ ARBOLEDA JESSICA PAOLA",
      "dia_semana": "VIERNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA H02",
      "nombre_curso": "DESARROLLO DE PROYECTOS - 9A II",
      "docente": "LÓPEZ ARBOLEDA JESSICA PAOLA",
      "dia_semana": "VIERNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA H03",
      "nombre_curso": "FÍSICA BÁSICA - 1A II",
      "docente": "VARGAS GUEVARA CARLOS LUIS",
      "dia_semana": "MARTES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA H03",
      "nombre_curso": "QUÍMICA - 1A II",
      "docente": "LEMA CHICAIZA FREDDY ROBERTO",
      "dia_semana": "MARTES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA H03",
      "nombre_curso": "QUÍMICA - 1A II",
      "docente": "LEMA CHICAIZA FREDDY ROBERTO",
      "dia_semana": "MARTES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA H03",
      "nombre_curso": "INTRODUCCIÓN A LA INGENIERÍA INDUSTRIAL - 1A II",
      "docente": "SÁNCHEZ ROSERO CARLOS HUMBERTO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA H03",
      "nombre_curso": "INTRODUCCIÓN A LA INGENIERÍA INDUSTRIAL - 1A II",
      "docente": "SÁNCHEZ ROSERO CARLOS HUMBERTO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA H03",
      "nombre_curso": "LÓGICA MATEMÁTICA - 1A II",
      "docente": "CARRILLO RIOS SANDRA LUCRECIA",
      "dia_semana": "MIERCOLES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA H03",
      "nombre_curso": "LÓGICA MATEMÁTICA - 1A II",
      "docente": "CARRILLO RIOS SANDRA LUCRECIA",
      "dia_semana": "MIERCOLES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "AULA H03",
      "nombre_curso": "GESTIÓN POR PROCESOS - 1A II",
      "docente": "ORTIZ GUERRERO DAYSI MARGARITA",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA H03",
      "nombre_curso": "GESTIÓN POR PROCESOS - 1A II",
      "docente": "ORTIZ GUERRERO DAYSI MARGARITA",
      "dia_semana": "MIERCOLES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA H03",
      "nombre_curso": "CONTROL NEUMÁTICO Y OLEOHIDRÁULICA - 1A II",
      "docente": "MARIÑO RIVERA CHRISTIAN JOSÉ",
      "dia_semana": "MIERCOLES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA H03",
      "nombre_curso": "CONTROL NEUMÁTICO Y OLEOHIDRÁULICA - 1A II",
      "docente": "MARIÑO RIVERA CHRISTIAN JOSÉ",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA H03",
      "nombre_curso": "GESTIÓN AMBIENTAL Y ENERGÍAS ALTERNATIVAS - 1A II",
      "docente": "UREÑA AGUIRRE JEANETTE DEL PILAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "AULA H03",
      "nombre_curso": "GESTIÓN AMBIENTAL Y ENERGÍAS ALTERNATIVAS - 1A II",
      "docente": "UREÑA AGUIRRE JEANETTE DEL PILAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "AULA H03",
      "nombre_curso": "ÁLGEBRA - 1A II",
      "docente": "TUBÓN NUÑEZ EDITH ELENA",
      "dia_semana": "JUEVES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA H03",
      "nombre_curso": "ÁLGEBRA - 1A II",
      "docente": "TUBÓN NUÑEZ EDITH ELENA",
      "dia_semana": "JUEVES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA H03",
      "nombre_curso": "DISEÑO DE PROYECTOS - 8A SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
      "dia_semana": "JUEVES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA H03",
      "nombre_curso": "DISEÑO DE PROYECTOS - 8A SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
      "dia_semana": "JUEVES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA H03",
      "nombre_curso": "LÓGICA MATEMÁTICA - 1A II",
      "docente": "CARRILLO RIOS SANDRA LUCRECIA",
      "dia_semana": "VIERNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA H03",
      "nombre_curso": "ÁLGEBRA - 1A II",
      "docente": "TUBÓN NUÑEZ EDITH ELENA",
      "dia_semana": "VIERNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA H03",
      "nombre_curso": "FÍSICA BÁSICA - 1A II",
      "docente": "VARGAS GUEVARA CARLOS LUIS",
      "dia_semana": "VIERNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA H03",
      "nombre_curso": "GESTIÓN AMBIENTAL Y ENERGÍAS ALTERNATIVAS - 6A II",
      "docente": "UREÑA AGUIRRE JEANETTE DEL PILAR",
      "dia_semana": "VIERNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "AULA H03",
      "nombre_curso": "GESTIÓN AMBIENTAL Y ENERGÍAS ALTERNATIVAS - 6A II",
      "docente": "UREÑA AGUIRRE JEANETTE DEL PILAR",
      "dia_semana": "VIERNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA H03",
      "nombre_curso": "CONTROL NEUMÁTICO Y OLEOHIDRÁULICA - 6A II",
      "docente": "MARIÑO RIVERA CHRISTIAN JOSÉ",
      "dia_semana": "VIERNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA H03",
      "nombre_curso": "CONTROL NEUMÁTICO Y OLEOHIDRÁULICA - 6A II",
      "docente": "MARIÑO RIVERA CHRISTIAN JOSÉ",
      "dia_semana": "VIERNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "ESTADÍSTICA Y PROBABILIDAD - 5A II",
      "docente": "ALDÁS SALAZAR DARWIN SANTIAGO",
      "dia_semana": "MARTES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "ESTADÍSTICA Y PROBABILIDAD - 5A II",
      "docente": "ALDÁS SALAZAR DARWIN SANTIAGO",
      "dia_semana": "MARTES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "CÁLCULO INTEGRAL - 5A II",
      "docente": "MORALES OÑATE BOLÍVAR EFRAÍN",
      "dia_semana": "MARTES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "CÁLCULO INTEGRAL - 5A II",
      "docente": "MORALES OÑATE BOLÍVAR EFRAÍN",
      "dia_semana": "MARTES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "TERMODINÁMICA - 5A II",
      "docente": "LEMA CHICAIZA FREDDY ROBERTO",
      "dia_semana": "MARTES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "CÁLCULO DIFERENCIAL - 2A II",
      "docente": "TUBÓN NUÑEZ EDITH ELENA",
      "dia_semana": "MARTES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "CÁLCULO DIFERENCIAL - 2A II",
      "docente": "TUBÓN NUÑEZ EDITH ELENA",
      "dia_semana": "MARTES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "ÁLGEBRA LINEAL - 2A II",
      "docente": "MORALES OÑATE BOLÍVAR EFRAÍN",
      "dia_semana": "MARTES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "ÁLGEBRA LINEAL - 2A II",
      "docente": "MORALES OÑATE BOLÍVAR EFRAÍN",
      "dia_semana": "MARTES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "GESTIÓN DE OPERACIONES - 3A II",
      "docente": "ROSERO MANTILLA CESAR ANIBAL",
      "dia_semana": "MIERCOLES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "GESTIÓN DE OPERACIONES - 3A II",
      "docente": "ROSERO MANTILLA CESAR ANIBAL",
      "dia_semana": "MIERCOLES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "PROCESOS INDUSTRIALES - 3A II",
      "docente": "NARANJO CHIRIBOGA ISRAEL ERNESTO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "PROCESOS INDUSTRIALES - 3A II",
      "docente": "NARANJO CHIRIBOGA ISRAEL ERNESTO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "CÁLCULO DIFERENCIAL - 2A II",
      "docente": "TUBÓN NUÑEZ EDITH ELENA",
      "dia_semana": "MIERCOLES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "ÁLGEBRA LINEAL - 2A II",
      "docente": "MORALES OÑATE BOLÍVAR EFRAÍN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "FÍSICA APLICADA - 2A II",
      "docente": "URRUTIA URRUTIA FERNANDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "FÍSICA APLICADA - 2A II",
      "docente": "URRUTIA URRUTIA FERNANDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "MÁQUINAS HERRAMIENTAS - 5A II",
      "docente": "MARIÑO RIVERA CHRISTIAN JOSÉ",
      "dia_semana": "JUEVES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "MÁQUINAS HERRAMIENTAS - 5A II",
      "docente": "MARIÑO RIVERA CHRISTIAN JOSÉ",
      "dia_semana": "JUEVES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "MÁQUINAS HERRAMIENTAS - 5A II",
      "docente": "MARIÑO RIVERA CHRISTIAN JOSÉ",
      "dia_semana": "JUEVES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "FÍSICA APLICADA - 2A II",
      "docente": "URRUTIA URRUTIA FERNANDO",
      "dia_semana": "JUEVES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "FÍSICA APLICADA - 2A II",
      "docente": "URRUTIA URRUTIA FERNANDO",
      "dia_semana": "JUEVES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "REALIDAD NACIONAL - 2A II",
      "docente": "CARRILLO RIOS SANDRA LUCRECIA",
      "dia_semana": "JUEVES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "REALIDAD NACIONAL - 2A II",
      "docente": "CARRILLO RIOS SANDRA LUCRECIA",
      "dia_semana": "JUEVES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "GESTIÓN DE OPERACIONES - 5A II",
      "docente": "ROSERO MANTILLA CESAR ANIBAL",
      "dia_semana": "VIERNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "GESTIÓN DE OPERACIONES - 5A II",
      "docente": "ROSERO MANTILLA CESAR ANIBAL",
      "dia_semana": "VIERNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA H04",
      "nombre_curso": "FÍSICA APLICADA - 2A II",
      "docente": "URRUTIA URRUTIA FERNANDO",
      "dia_semana": "VIERNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "TECNOLOGÍA DE LOS MATERIALES - 3B II",
      "docente": "MARIÑO RIVERA CHRISTIAN JOSÉ",
      "dia_semana": "MARTES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "TECNOLOGÍA DE LOS MATERIALES - 3B II",
      "docente": "MARIÑO RIVERA CHRISTIAN JOSÉ",
      "dia_semana": "MARTES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "GESTIÓN DE CALIDAD - 2B IT",
      "docente": "MARIÑO RIVERA CHRISTIAN JOSÉ",
      "dia_semana": "MARTES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "GESTIÓN DE CALIDAD - 2B IT",
      "docente": "MARIÑO RIVERA CHRISTIAN JOSÉ",
      "dia_semana": "MARTES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "EMPRENDIMIENTO Y LEGISLACIÓN LABORAL - 2B IT",
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA",
      "dia_semana": "MARTES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "EMPRENDIMIENTO Y LEGISLACIÓN LABORAL - 2B IT",
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA",
      "dia_semana": "MARTES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "EMPRENDIMIENTO Y LEGISLACIÓN LABORAL - 2B IT",
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA",
      "dia_semana": "MARTES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "CÁLCULO INTEGRAL - 3B II",
      "docente": "MORALES OÑATE BOLÍVAR EFRAÍN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "ELECTRÓNICA Y ELECTRICIDAD - 3B II",
      "docente": "VARGAS GUEVARA CARLOS LUIS",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "ELECTRÓNICA Y ELECTRICIDAD - 3B II",
      "docente": "VARGAS GUEVARA CARLOS LUIS",
      "dia_semana": "MIERCOLES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "GESTIÓN DE CALIDAD - 8A II",
      "docente": "UREÑA AGUIRRE JEANETTE DEL PILAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "GESTIÓN DE CALIDAD - 8A II",
      "docente": "UREÑA AGUIRRE JEANETTE DEL PILAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "EMPRENDIMIENTO Y LEGISLACIÓN LABORAL - 8A SW",
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA",
      "dia_semana": "MIERCOLES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "EMPRENDIMIENTO Y LEGISLACIÓN LABORAL - 8A SW",
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA",
      "dia_semana": "MIERCOLES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "CÁLCULO INTEGRAL - 3B II",
      "docente": "MORALES OÑATE BOLÍVAR EFRAÍN",
      "dia_semana": "JUEVES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "INVESTIGACIÓN DE OPERACIONES - 3B II",
      "docente": "ORTIZ GUERRERO DAYSI MARGARITA",
      "dia_semana": "JUEVES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "INVESTIGACIÓN DE OPERACIONES - 3B II",
      "docente": "ORTIZ GUERRERO DAYSI MARGARITA",
      "dia_semana": "JUEVES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "FÍSICA APLICADA - 2B IT",
      "docente": "BENALCAZAR PALACIOS FREDDY GEOVANNY",
      "dia_semana": "JUEVES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "GESTIÓN DE CALIDAD - 2B IT",
      "docente": "UREÑA AGUIRRE JEANETTE DEL PILAR",
      "dia_semana": "JUEVES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "REALIDAD NACIONAL - 6A SW",
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA",
      "dia_semana": "JUEVES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "REALIDAD NACIONAL - 6A SW",
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA",
      "dia_semana": "JUEVES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "FÍSICA APLICADA - 2B IT",
      "docente": "BENALCAZAR PALACIOS FREDDY GEOVANNY",
      "dia_semana": "VIERNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "FÍSICA APLICADA - 2B IT",
      "docente": "BENALCAZAR PALACIOS FREDDY GEOVANNY",
      "dia_semana": "VIERNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "REALIDAD NACIONAL - 6A SW",
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA",
      "dia_semana": "VIERNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "REALIDAD NACIONAL - 6A SW",
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA",
      "dia_semana": "VIERNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "FÍSICA - 1A SW",
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO",
      "dia_semana": "LUNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "FÍSICA - 1A SW",
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO",
      "dia_semana": "LUNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "ÁLGEBRA LINEAL - 1A SW",
      "docente": "REYES BEDOYA DONALD EDUARDO",
      "dia_semana": "LUNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "ÁLGEBRA LINEAL - 1A SW",
      "docente": "REYES BEDOYA DONALD EDUARDO",
      "dia_semana": "LUNES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "ÁLGEBRA LINEAL - 1A SW",
      "docente": "REYES BEDOYA DONALD EDUARDO",
      "dia_semana": "LUNES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "FÍSICA - 1A TI",
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "ÁLGEBRA LINEAL - 1A TI",
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "ÁLGEBRA LINEAL - 1A TI",
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "CÁLCULO INTEGRAL - 1A TI",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "CÁLCULO INTEGRAL - 1A TI",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "CÁLCULO INTEGRAL - 2B SW",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "LÓGICA MATEMÁTICA - 1A SW",
      "docente": "TORRES ABRIL PAULO CESAR",
      "dia_semana": "JUEVES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "FÍSICA - 1A TI",
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO",
      "dia_semana": "JUEVES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "FÍSICA - 1A SW",
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO",
      "dia_semana": "JUEVES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "FÍSICA - 1A SW",
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO",
      "dia_semana": "JUEVES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "CÁLCULO DIFERENCIAL - 1A SW",
      "docente": "CASTRO MAYORGA MARITZA ELIZABETH",
      "dia_semana": "VIERNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "LÓGICA MATEMÁTICA - 1A SW",
      "docente": "TORRES ABRIL PAULO CESAR",
      "dia_semana": "VIERNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "PROBABILIDAD Y ESTADÍSTICA - 3A SW",
      "docente": "REYES BEDOYA DONALD EDUARDO",
      "dia_semana": "LUNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "MÉTODOS NUMÉRICOS - 3A SW",
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN",
      "dia_semana": "LUNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "MÉTODOS NUMÉRICOS - 3A SW",
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN",
      "dia_semana": "LUNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "REALIDAD NACIONAL - 3A SW",
      "docente": "MORALES LOZADA JOSE VICENTE",
      "dia_semana": "LUNES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "REALIDAD NACIONAL - 3A SW",
      "docente": "MORALES LOZADA JOSE VICENTE",
      "dia_semana": "LUNES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "PROBABILIDAD Y ESTADÍSTICA - 3A TI",
      "docente": "REYES BEDOYA DONALD EDUARDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "PROBABILIDAD Y ESTADÍSTICA - 1A SW",
      "docente": "REYES BEDOYA DONALD EDUARDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "PROBABILIDAD Y ESTADÍSTICA - 1A SW",
      "docente": "REYES BEDOYA DONALD EDUARDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "MEDIDAS ELÉCTRICAS - 2A TI",
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "MEDIDAS ELÉCTRICAS - 2A TI",
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "MEDIDAS ELÉCTRICAS - 2A TI",
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "PROBABILIDAD Y ESTADÍSTICA - 3B SW",
      "docente": "ALDÁS SALAZAR DARWIN SANTIAGO",
      "dia_semana": "JUEVES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "PROBABILIDAD Y ESTADÍSTICA - 3B SW",
      "docente": "ALDÁS SALAZAR DARWIN SANTIAGO",
      "dia_semana": "JUEVES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "INVESTIGACIÓN OPERATIVA - 5A SW",
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR",
      "dia_semana": "JUEVES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "INVESTIGACIÓN OPERATIVA - 5A SW",
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR",
      "dia_semana": "JUEVES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "CÁLCULO INTEGRAL - 2A TI",
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR",
      "dia_semana": "JUEVES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "CÁLCULO INTEGRAL - 2A TI",
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR",
      "dia_semana": "JUEVES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "MÉTODOS NUMÉRICOS - 3A SW",
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN",
      "dia_semana": "VIERNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "MÉTODOS NUMÉRICOS - 3A SW",
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN",
      "dia_semana": "VIERNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "LÓGICA MATEMÁTICA - 2A TI",
      "docente": "TORRES ABRIL PAULO CESAR",
      "dia_semana": "VIERNES",
      "hora_ini": "13:00",
      "hora_fin": "14:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "CÁLCULO INTEGRAL - 2A TI",
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR",
      "dia_semana": "VIERNES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "CÁLCULO INTEGRAL - 2A TI",
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR",
      "dia_semana": "VIERNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "CÁLCULO INTEGRAL - 2A TI",
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR",
      "dia_semana": "VIERNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "MÉTODOS NUMÉRICOS - 1B TI",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "MARTES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "CÁLCULO DIFERENCIAL - 1B TI",
      "docente": "CASTRO MAYORGA MARITZA ELIZABETH",
      "dia_semana": "MARTES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "CÁLCULO DIFERENCIAL - 1A TI",
      "docente": "CASTRO MAYORGA MARITZA ELIZABETH",
      "dia_semana": "MARTES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "ÁLGEBRA LINEAL - 1A TI",
      "docente": "REYES BEDOYA DONALD EDUARDO",
      "dia_semana": "MARTES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "ÁLGEBRA LINEAL - 1A TI",
      "docente": "REYES BEDOYA DONALD EDUARDO",
      "dia_semana": "MARTES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "CÁLCULO INTEGRAL - 1A TI",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "MARTES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "CÁLCULO INTEGRAL - 1A TI",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "MARTES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "CÁLCULO DIFERENCIAL - 3B SW",
      "docente": "CASTRO MAYORGA MARITZA ELIZABETH",
      "dia_semana": "MIERCOLES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "CÁLCULO DIFERENCIAL - 1B TI",
      "docente": "CASTRO MAYORGA MARITZA ELIZABETH",
      "dia_semana": "MIERCOLES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "CÁLCULO DIFERENCIAL - 1B TI",
      "docente": "CASTRO MAYORGA MARITZA ELIZABETH",
      "dia_semana": "MIERCOLES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "CÁLCULO INTEGRAL - 1B TI",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "CÁLCULO INTEGRAL - 2A SW",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "CÁLCULO INTEGRAL - 2A SW",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "ÁLGEBRA LINEAL - 1A SW",
      "docente": "REYES BEDOYA DONALD EDUARDO",
      "dia_semana": "JUEVES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "ÁLGEBRA LINEAL - 1A SW",
      "docente": "REYES BEDOYA DONALD EDUARDO",
      "dia_semana": "JUEVES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "FÍSICA - 1A SW",
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN",
      "dia_semana": "JUEVES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "FÍSICA - 1A SW",
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN",
      "dia_semana": "JUEVES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "FÍSICA - 1A SW",
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN",
      "dia_semana": "JUEVES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "FÍSICA - 1B TI",
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN",
      "dia_semana": "VIERNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "MÉTODOS NUMÉRICOS - 3B SW",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "VIERNES",
      "hora_ini": "8:00",
      "hora_fin": "9:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "MÉTODOS NUMÉRICOS - 3B SW",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "VIERNES",
      "hora_ini": "9:00",
      "hora_fin": "10:00"
    }
  ]
};

runSeedHorarios(DATA, { label: 'TODAS LAS CARRERAS' })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = require('./_horarios-runner');
    await prisma.$disconnect();
  });
