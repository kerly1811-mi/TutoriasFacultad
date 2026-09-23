// ============================================================================
// ⚠️  SCRIPT DE CARGA (no borra nada, solo inserta) ⚠️
// Carga el horario de SOLO SOFTWARE (código "SW") de la FISEI (periodo JULIO - DICIEMBRE 2026),
// extraído de Horarios-Fisei.pdf.
//
// Orden recomendado (desde la carpeta backend-facultad):
//   node prisma/reset-datos.js --si-estoy-seguro   (una sola vez, borra todo)
//   node prisma/seed-horarios-software.js
//
// Es idempotente (busca por nombre/cédula antes de crear), así que se puede
// correr varias veces sin duplicar filas.
//
// ---------------------------------------------------------------------------
// CÓMO SE LEYÓ EL PDF
// ---------------------------------------------------------------------------
// Cada texto se asigna a la celda (día, hora) usando las LÍNEAS de la
// cuadrícula dibujada en el PDF, no la cercanía al rótulo de la hora. El
// número grande de la columna izquierda es la hora de inicio de la fila
// (ej. fila "8 / 8:00 - 9:00" -> hora_ini 08:00). La versión anterior de este
// script asignaba la etiqueta del curso (ej. "3B SW"), que va pegada al borde
// superior de la celda, a la fila de arriba: por eso todo salía una hora
// antes y algunas celdas mezclaban la materia de una hora con el código de
// la vecina. Verificado: ningún texto del PDF cruza el borde de su celda.
//
// Dentro de cada celda: código "nivel+paralelo carrera" (ej. "3B SW"),
// materia (fuente mediana) y docente (fuente más chica).
//   SW = Software, TI = Tecnologías de la Información, IT = Telecomunicaciones,
//   II = Industrial, RA = Robótica.
//
// ---------------------------------------------------------------------------
// SUPUESTOS
// ---------------------------------------------------------------------------
// 1. Solo se procesan hojas cuyo título termina en "EDIFICIO 1"/"EDIFICIO 2"
//    (se ignoran LAB. CNC - TALLERES, ÁREA PRÁCTICA TALLERES y AULA 7-10
//    CIENCIAS APLICADAS).
// 2. Se omiten celdas sin código de curso: "DESARROLLO DE GUÍAS APE",
//    "CÉLULA FISEI" y 2 horas de "CONTROL NEUMÁTICO E HIDRAÚLICO" (LAB.
//    AUTOMATIZACIÓN INDUSTRIAL, martes 16:00-18:00) que no traen nivel/carrera.
// 3. El sufijo "(APE)"/"(PAE)" se quita del nombre de la materia: es la misma
//    materia, solo marca las horas prácticas.
// 4. Grafías sin tilde del PDF se unificaron con la versión con tilde
//    (ej. "ADMINISTRACION DE LA PRODUCCIÓN" -> "ADMINISTRACIÓN DE LA ...").
// 5. Cada hora del PDF es un HorarioClase independiente; horas en formato
//    "HH:MM" con cero a la izquierda ("07:00") para que ordenen bien.
// 6. Espacios: piso/bloque/capacidad igual que antes (capacidad = número
//    entre paréntesis del título de la hoja).
// 7. Docentes: nombres/apellidos = dos primeras palabras son apellidos (con
//    partículas "DE", "DEL", "LA"...), el resto nombres. Correos inventados
//    (apellido.nombre@uta.edu.ec) y cédulas sintéticas válidas con prefijo
//    "181" (no chocan con el admin 1899999999 ni el laboratorista
//    1800000018). La cédula de cada docente es la misma en ambos scripts.
//    Clave de todos los docentes: secret123.
// 8. Docentes que el PDF escribe de dos formas se unificaron en uno solo:
//    Morales Lozada José Vicente, Guamán Molina Jesús Israel, Córdova
//    Córdova Édgar Patricio y López Flores Xavier Mauricio (este último
//    aparece también como "LOPEZ FLORES MAURICIO XAVIER"). Urrutia Urrutia
//    Elsa Pilar y Urrutia Urrutia Fernando son dos personas distintas.
// 9. No hay clases de 13:00 a 14:00 (almuerzo); el PDF no trae ninguna.
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
      "nom_esp": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "tipo": "LABORATORIO",
      "capacidad": 40,
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
      "nom_esp": "AULA F03",
      "tipo": "AULA",
      "capacidad": 40,
      "bloque": "BLOQUE_2",
      "piso": "F",
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
      "nom_esp": "AULA H03",
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
    "Software"
  ],
  "niveles": [
    {
      "nom_niv": "Primer Semestre",
      "carrera": "Software",
      "numero": 1
    },
    {
      "nom_niv": "Segundo Semestre",
      "carrera": "Software",
      "numero": 2
    },
    {
      "nom_niv": "Tercer Semestre",
      "carrera": "Software",
      "numero": 3
    },
    {
      "nom_niv": "Cuarto Semestre",
      "carrera": "Software",
      "numero": 4
    },
    {
      "nom_niv": "Quinto Semestre",
      "carrera": "Software",
      "numero": 5
    },
    {
      "nom_niv": "Sexto Semestre",
      "carrera": "Software",
      "numero": 6
    },
    {
      "nom_niv": "Séptimo Semestre",
      "carrera": "Software",
      "numero": 7
    },
    {
      "nom_niv": "Octavo Semestre",
      "carrera": "Software",
      "numero": 8
    }
  ],
  "materias": [
    "ÁLGEBRA LINEAL",
    "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN",
    "APLICACIONES DISTRIBUIDAS",
    "APLICACIONES ORIENTADAS A SERVICIOS",
    "APLICACIONES WEB Y MÓVILES",
    "AUDITORÍA DE SISTEMAS DE INFORMACIÓN",
    "BASE DE DATOS",
    "CÁLCULO DIFERENCIAL",
    "CÁLCULO INTEGRAL",
    "COMPUTACIÓN VISUAL",
    "DESARROLLO ASISTIDO POR SOFTWARE",
    "DISEÑO DE PROYECTOS",
    "EMPRENDIMIENTO Y LEGISLACIÓN LABORAL",
    "ESTRUCTURA DE DATOS",
    "FÍSICA",
    "FUNDAMENTOS DE LA INGENIERÍA DE SOFTWARE",
    "GESTIÓN DE CALIDAD DEL SOFTWARE",
    "GESTIÓN DE PROYECTOS DE SOFTWARE",
    "GESTIÓN DE PRUEBAS E IMPLANTACIÓN DE SOFTWARE",
    "INGENIERÍA ECONÓMICA PARA SOFTWARE",
    "INTELIGENCIA ARTIFICIAL",
    "INTELIGENCIA DE NEGOCIOS",
    "INTERACCIÓN HUMANO / COMPUTADOR",
    "INTERACCIÓN HUMANO COMPUTADOR",
    "INTRODUCCIÓN A REDES",
    "INVESTIGACIÓN OPERATIVA",
    "LÓGICA MATEMÁTICA",
    "MANEJO Y CONFIGURACIÓN DEL SOFTWARE",
    "METODOLOGÍA DE LA INVESTIGACIÓN",
    "METODOLOGÍAS ÁGILES",
    "MÉTODOS NUMÉRICOS",
    "MODELAMIENTO Y DISEÑO DE SOFTWARE",
    "PATRONES DE SOFTWARE",
    "PROBABILIDAD Y ESTADÍSTICA",
    "PROGRAMACIÓN ORIENTADA A OBJETOS",
    "REALIDAD NACIONAL",
    "REDES",
    "SEGURIDAD EN EL DESARROLLO DEL SOFTWARE",
    "SISTEMAS DE SOPORTE DE DECISIONES",
    "SISTEMAS OPERATIVOS"
  ],
  "docentes": [
    {
      "nombreCompleto": "ALDÁS FLORES CLAY FERNANDO",
      "nombres": "Clay Fernando",
      "apellidos": "Aldás Flores",
      "cedula": "1810000016",
      "correo": "aldas.fernando@uta.edu.ec"
    },
    {
      "nombreCompleto": "ALDÁS SALAZAR DARWIN SANTIAGO",
      "nombres": "Darwin Santiago",
      "apellidos": "Aldás Salazar",
      "cedula": "1810000024",
      "correo": "aldas.santiago@uta.edu.ec"
    },
    {
      "nombreCompleto": "ÁLVAREZ MAYORGA EDISON HOMERO",
      "nombres": "Edison Homero",
      "apellidos": "Álvarez Mayorga",
      "cedula": "1810000040",
      "correo": "alvarez.homero@uta.edu.ec"
    },
    {
      "nombreCompleto": "BALAREZO LÓPEZ JULIO ENRIQUE",
      "nombres": "Julio Enrique",
      "apellidos": "Balarezo López",
      "cedula": "1810000065",
      "correo": "balarezo.enrique@uta.edu.ec"
    },
    {
      "nombreCompleto": "BENITEZ ALDAS MARCOS RAPHAEL",
      "nombres": "Marcos Raphael",
      "apellidos": "Benitez Aldas",
      "cedula": "1810000081",
      "correo": "benitez.raphael@uta.edu.ec"
    },
    {
      "nombreCompleto": "BUENAÑO VALENCIA EDWIN HERNANDO",
      "nombres": "Edwin Hernando",
      "apellidos": "Buenaño Valencia",
      "cedula": "1810000099",
      "correo": "buenano.hernando@uta.edu.ec"
    },
    {
      "nombreCompleto": "CAIZA CAIZABUANO JOSE RUBEN",
      "nombres": "Jose Ruben",
      "apellidos": "Caiza Caizabuano",
      "cedula": "1810000107",
      "correo": "caiza.ruben@uta.edu.ec"
    },
    {
      "nombreCompleto": "CASTRO MAYORGA MARITZA ELIZABETH",
      "nombres": "Maritza Elizabeth",
      "apellidos": "Castro Mayorga",
      "cedula": "1810000131",
      "correo": "castro.elizabeth@uta.edu.ec"
    },
    {
      "nombreCompleto": "CAZORLA LOGROÑO MARIA FRANCISCA",
      "nombres": "Maria Francisca",
      "apellidos": "Cazorla Logroño",
      "cedula": "1810000149",
      "correo": "cazorla.francisca@uta.edu.ec"
    },
    {
      "nombreCompleto": "CHANGO SAILEMA WILSON GUSTAVO",
      "nombres": "Wilson Gustavo",
      "apellidos": "Chango Sailema",
      "cedula": "1810000156",
      "correo": "chango.gustavo@uta.edu.ec"
    },
    {
      "nombreCompleto": "CHICAIZA CASTILLO DENNIS VINICIO",
      "nombres": "Dennis Vinicio",
      "apellidos": "Chicaiza Castillo",
      "cedula": "1810000164",
      "correo": "chicaiza.vinicio@uta.edu.ec"
    },
    {
      "nombreCompleto": "FERNÁNDEZ PEÑA FÉLIX OSCAR",
      "nombres": "Félix Oscar",
      "apellidos": "Fernández Peña",
      "cedula": "1810000222",
      "correo": "fernandez.oscar@uta.edu.ec"
    },
    {
      "nombreCompleto": "GUACHIMBOZA VILLALBA MARCO VINICIO",
      "nombres": "Marco Vinicio",
      "apellidos": "Guachimboza Villalba",
      "cedula": "1810000271",
      "correo": "guachimboza.vinicio@uta.edu.ec"
    },
    {
      "nombreCompleto": "IBARRA TORRES OSCAR FERNANDO",
      "nombres": "Oscar Fernando",
      "apellidos": "Ibarra Torres",
      "cedula": "1810000313",
      "correo": "ibarra.fernando@uta.edu.ec"
    },
    {
      "nombreCompleto": "JARA MOYA SANTIAGO DAVID",
      "nombres": "Santiago David",
      "apellidos": "Jara Moya",
      "cedula": "1810000321",
      "correo": "jara.david@uta.edu.ec"
    },
    {
      "nombreCompleto": "JEREZ MAYORGA DANIEL SEBASTIAN",
      "nombres": "Daniel Sebastian",
      "apellidos": "Jerez Mayorga",
      "cedula": "1810000339",
      "correo": "jerez.sebastian@uta.edu.ec"
    },
    {
      "nombreCompleto": "MAIGUA QUINTEROS ALEX JAVIER",
      "nombres": "Alex Javier",
      "apellidos": "Maigua Quinteros",
      "cedula": "1810000370",
      "correo": "maigua.javier@uta.edu.ec"
    },
    {
      "nombreCompleto": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "nombres": "Daniel Alejandro",
      "apellidos": "Maldonado Ruiz",
      "cedula": "1810000388",
      "correo": "maldonado.alejandro@uta.edu.ec"
    },
    {
      "nombreCompleto": "NARANJO AVALOS HERNAN FABRICIO",
      "nombres": "Hernan Fabricio",
      "apellidos": "Naranjo Avalos",
      "cedula": "1810000461",
      "correo": "naranjo.fabricio@uta.edu.ec"
    },
    {
      "nombreCompleto": "NOGALES PORTERO RUBEN EDUARDO",
      "nombres": "Ruben Eduardo",
      "apellidos": "Nogales Portero",
      "cedula": "1810000487",
      "correo": "nogales.eduardo@uta.edu.ec"
    },
    {
      "nombreCompleto": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "nombres": "Carlos Israel",
      "apellidos": "Nuñez Miranda",
      "cedula": "1810000495",
      "correo": "nunez.israel@uta.edu.ec"
    },
    {
      "nombreCompleto": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR",
      "nombres": "William Wladimir",
      "apellidos": "Ortiz Fernández",
      "cedula": "1810000503",
      "correo": "ortiz.wladimir@uta.edu.ec"
    },
    {
      "nombreCompleto": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "nombres": "Victor Filiberto",
      "apellidos": "Peñafiel Gaibor",
      "cedula": "1810000529",
      "correo": "penafiel.filiberto@uta.edu.ec"
    },
    {
      "nombreCompleto": "REYES BEDOYA DONALD EDUARDO",
      "nombres": "Donald Eduardo",
      "apellidos": "Reyes Bedoya",
      "cedula": "1810000545",
      "correo": "reyes.eduardo@uta.edu.ec"
    },
    {
      "nombreCompleto": "REYES VASQUEZ JOHN PAUL",
      "nombres": "John Paul",
      "apellidos": "Reyes Vasquez",
      "cedula": "1810000552",
      "correo": "reyes.paul@uta.edu.ec"
    },
    {
      "nombreCompleto": "SANTAMARIA VILLACIS MARLON ANTONIO",
      "nombres": "Marlon Antonio",
      "apellidos": "Santamaria Villacis",
      "cedula": "1810000636",
      "correo": "santamaria.antonio@uta.edu.ec"
    },
    {
      "nombreCompleto": "SOLIS SALAZAR JUAN SEBASTIÁN",
      "nombres": "Juan Sebastián",
      "apellidos": "Solis Salazar",
      "cedula": "1810000651",
      "correo": "solis.sebastian@uta.edu.ec"
    },
    {
      "nombreCompleto": "TORRES ABRIL PAULO CESAR",
      "nombres": "Paulo Cesar",
      "apellidos": "Torres Abril",
      "cedula": "1810000677",
      "correo": "torres.cesar@uta.edu.ec"
    },
    {
      "nombreCompleto": "TORRES VALVERDE LEONARDO DAVID",
      "nombres": "Leonardo David",
      "apellidos": "Torres Valverde",
      "cedula": "1810000685",
      "correo": "torres.david@uta.edu.ec"
    },
    {
      "nombreCompleto": "URRUTIA URRUTIA ELSA PILAR",
      "nombres": "Elsa Pilar",
      "apellidos": "Urrutia Urrutia",
      "cedula": "1810000719",
      "correo": "urrutia.pilar@uta.edu.ec"
    },
    {
      "nombreCompleto": "VARGAS PAREDES JAVIER SANTIAGO",
      "nombres": "Javier Santiago",
      "apellidos": "Vargas Paredes",
      "cedula": "1810000768",
      "correo": "vargas.santiago@uta.edu.ec"
    }
  ],
  "paralelos": [
    {
      "nom_par": "A",
      "materia": "ÁLGEBRA LINEAL",
      "carrera": "Software",
      "nivelNumero": 1,
      "docente": "REYES BEDOYA DONALD EDUARDO"
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
      "materia": "CÁLCULO DIFERENCIAL",
      "carrera": "Software",
      "nivelNumero": 1,
      "docente": "CASTRO MAYORGA MARITZA ELIZABETH"
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
      "materia": "LÓGICA MATEMÁTICA",
      "carrera": "Software",
      "nivelNumero": 1,
      "docente": "TORRES ABRIL PAULO CESAR"
    },
    {
      "nom_par": "B",
      "materia": "ÁLGEBRA LINEAL",
      "carrera": "Software",
      "nivelNumero": 1,
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR"
    },
    {
      "nom_par": "B",
      "materia": "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN",
      "carrera": "Software",
      "nivelNumero": 1,
      "docente": "CAIZA CAIZABUANO JOSE RUBEN"
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
      "materia": "FÍSICA",
      "carrera": "Software",
      "nivelNumero": 1,
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO"
    },
    {
      "nom_par": "B",
      "materia": "LÓGICA MATEMÁTICA",
      "carrera": "Software",
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
      "materia": "FUNDAMENTOS DE LA INGENIERÍA DE SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 2,
      "docente": "IBARRA TORRES OSCAR FERNANDO"
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
      "materia": "PROGRAMACIÓN ORIENTADA A OBJETOS",
      "carrera": "Software",
      "nivelNumero": 2,
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR"
    },
    {
      "nom_par": "A",
      "materia": "SISTEMAS OPERATIVOS",
      "carrera": "Software",
      "nivelNumero": 2,
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN"
    },
    {
      "nom_par": "B",
      "materia": "CÁLCULO INTEGRAL",
      "carrera": "Software",
      "nivelNumero": 2,
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO"
    },
    {
      "nom_par": "B",
      "materia": "FUNDAMENTOS DE LA INGENIERÍA DE SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 2,
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE"
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
      "materia": "PROGRAMACIÓN ORIENTADA A OBJETOS",
      "carrera": "Software",
      "nivelNumero": 2,
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN"
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
      "materia": "ESTRUCTURA DE DATOS",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR"
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
      "materia": "MÉTODOS NUMÉRICOS",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN"
    },
    {
      "nom_par": "A",
      "materia": "MODELAMIENTO Y DISEÑO DE SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "TORRES VALVERDE LEONARDO DAVID"
    },
    {
      "nom_par": "A",
      "materia": "PROBABILIDAD Y ESTADÍSTICA",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "REYES BEDOYA DONALD EDUARDO"
    },
    {
      "nom_par": "B",
      "materia": "ESTRUCTURA DE DATOS",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "CAIZA CAIZABUANO JOSE RUBEN"
    },
    {
      "nom_par": "B",
      "materia": "INTRODUCCIÓN A REDES",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO"
    },
    {
      "nom_par": "B",
      "materia": "MÉTODOS NUMÉRICOS",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO"
    },
    {
      "nom_par": "B",
      "materia": "MODELAMIENTO Y DISEÑO DE SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "TORRES VALVERDE LEONARDO DAVID"
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
      "materia": "BASE DE DATOS",
      "carrera": "Software",
      "nivelNumero": 4,
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO"
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
      "materia": "MANEJO Y CONFIGURACIÓN DEL SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 4,
      "docente": "JARA MOYA SANTIAGO DAVID"
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
      "materia": "REDES",
      "carrera": "Software",
      "nivelNumero": 4,
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO"
    },
    {
      "nom_par": "B",
      "materia": "BASE DE DATOS",
      "carrera": "Software",
      "nivelNumero": 4,
      "docente": "GUACHIMBOZA VILLALBA MARCO VINICIO"
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
      "materia": "MANEJO Y CONFIGURACIÓN DEL SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 4,
      "docente": "JARA MOYA SANTIAGO DAVID"
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
      "materia": "REDES",
      "carrera": "Software",
      "nivelNumero": 4,
      "docente": "CHANGO SAILEMA WILSON GUSTAVO"
    },
    {
      "nom_par": "A",
      "materia": "APLICACIONES ORIENTADAS A SERVICIOS",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL"
    },
    {
      "nom_par": "A",
      "materia": "INTERACCIÓN HUMANO / COMPUTADOR",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "CAIZA CAIZABUANO JOSE RUBEN"
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
      "materia": "INVESTIGACIÓN OPERATIVA",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR"
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
      "materia": "SISTEMAS DE SOPORTE DE DECISIONES",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "ÁLVAREZ MAYORGA EDISON HOMERO"
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
      "materia": "INTERACCIÓN HUMANO COMPUTADOR",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "CAIZA CAIZABUANO JOSE RUBEN"
    },
    {
      "nom_par": "B",
      "materia": "INVESTIGACIÓN OPERATIVA",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR"
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
      "materia": "SISTEMAS DE SOPORTE DE DECISIONES",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "VARGAS PAREDES JAVIER SANTIAGO"
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
      "materia": "APLICACIONES WEB Y MÓVILES",
      "carrera": "Software",
      "nivelNumero": 6,
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO"
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
      "materia": "INTELIGENCIA DE NEGOCIOS",
      "carrera": "Software",
      "nivelNumero": 6,
      "docente": "NOGALES PORTERO RUBEN EDUARDO"
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
      "materia": "AUDITORÍA DE SISTEMAS DE INFORMACIÓN",
      "carrera": "Software",
      "nivelNumero": 7,
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE"
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
      "materia": "GESTIÓN DE CALIDAD DEL SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 7,
      "docente": "MAIGUA QUINTEROS ALEX JAVIER"
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
      "materia": "INTELIGENCIA ARTIFICIAL",
      "carrera": "Software",
      "nivelNumero": 7,
      "docente": "NOGALES PORTERO RUBEN EDUARDO"
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
      "materia": "EMPRENDIMIENTO Y LEGISLACIÓN LABORAL",
      "carrera": "Software",
      "nivelNumero": 8,
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA"
    },
    {
      "nom_par": "A",
      "materia": "INGENIERÍA ECONÓMICA PARA SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 8,
      "docente": "JARA MOYA SANTIAGO DAVID"
    },
    {
      "nom_par": "A",
      "materia": "SEGURIDAD EN EL DESARROLLO DEL SOFTWARE",
      "carrera": "Software",
      "nivelNumero": 8,
      "docente": "IBARRA TORRES OSCAR FERNANDO"
    }
  ],
  "horarios": [
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "MODELAMIENTO Y DISEÑO DE SOFTWARE - 3B SW",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "LUNES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "MODELAMIENTO Y DISEÑO DE SOFTWARE - 3B SW",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "LUNES",
      "hora_ini": "09:00",
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
      "nombre_curso": "ESTRUCTURA DE DATOS - 3B SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "LUNES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
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
      "nombre_curso": "INTELIGENCIA DE NEGOCIOS - 6A SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
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
      "nombre_curso": "PROGRAMACIÓN ORIENTADA A OBJETOS - 2B SW",
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN",
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
      "nombre_curso": "REDES - 4A SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "LUNES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "INTRODUCCIÓN A REDES - 3B SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "MARTES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "INTRODUCCIÓN A REDES - 3B SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "MARTES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "DISEÑO DE PROYECTOS - 8A SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
      "dia_semana": "MARTES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "DISEÑO DE PROYECTOS - 8A SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
      "dia_semana": "MARTES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "INTELIGENCIA DE NEGOCIOS - 6A SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
      "dia_semana": "MARTES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "INTELIGENCIA DE NEGOCIOS - 6A SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
      "dia_semana": "MARTES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "INTRODUCCIÓN A REDES - 3B SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "INTRODUCCIÓN A REDES - 3B SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
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
      "nombre_curso": "MODELAMIENTO Y DISEÑO DE SOFTWARE - 3B SW",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "MIERCOLES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
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
      "nombre_curso": "INTELIGENCIA DE NEGOCIOS - 6A SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
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
      "nombre_curso": "INTRODUCCIÓN A REDES - 3B SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "JUEVES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
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
      "nombre_curso": "INGENIERÍA ECONÓMICA PARA SOFTWARE - 8A SW",
      "docente": "JARA MOYA SANTIAGO DAVID",
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
      "nombre_curso": "REDES - 4A SW",
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
      "nombre_curso": "SISTEMAS OPERATIVOS - 2B SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "JUEVES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN - 1B SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "VIERNES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 1",
      "nombre_curso": "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN - 1B SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "VIERNES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
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
      "nombre_curso": "PROGRAMACIÓN ORIENTADA A OBJETOS - 2B SW",
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN",
      "dia_semana": "VIERNES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
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
      "nombre_curso": "APLICACIONES ORIENTADAS A SERVICIOS - 5A SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "LUNES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
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
      "nombre_curso": "COMPUTACIÓN VISUAL - 4B SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "LUNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
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
      "nombre_curso": "REDES - 4B SW",
      "docente": "CHANGO SAILEMA WILSON GUSTAVO",
      "dia_semana": "LUNES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "APLICACIONES ORIENTADAS A SERVICIOS - 5A SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "MARTES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "APLICACIONES ORIENTADAS A SERVICIOS - 5A SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "MARTES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN - 1A SW",
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL",
      "dia_semana": "MARTES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN - 1A SW",
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL",
      "dia_semana": "MARTES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "COMPUTACIÓN VISUAL - 4A SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "MARTES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "COMPUTACIÓN VISUAL - 4A SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "MARTES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "COMPUTACIÓN VISUAL - 4A SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "MARTES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "REDES - 4B SW",
      "docente": "CHANGO SAILEMA WILSON GUSTAVO",
      "dia_semana": "MARTES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "REDES - 4B SW",
      "docente": "CHANGO SAILEMA WILSON GUSTAVO",
      "dia_semana": "MARTES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN - 1B SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "07:00",
      "hora_fin": "08:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN - 1B SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
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
      "nombre_curso": "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN - 1A SW",
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL",
      "dia_semana": "MIERCOLES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "COMPUTACIÓN VISUAL - 4B SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "COMPUTACIÓN VISUAL - 4B SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "MIERCOLES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "COMPUTACIÓN VISUAL - 4B SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "MIERCOLES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "SISTEMAS OPERATIVOS - 2B SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "SISTEMAS OPERATIVOS - 2B SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "SISTEMAS OPERATIVOS - 2B SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "ESTRUCTURA DE DATOS - 3B SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "JUEVES",
      "hora_ini": "07:00",
      "hora_fin": "08:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "ESTRUCTURA DE DATOS - 3B SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "JUEVES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN - 1A SW",
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL",
      "dia_semana": "JUEVES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN - 1A SW",
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL",
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
      "nombre_curso": "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN - 1B SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "JUEVES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
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
      "nombre_curso": "COMPUTACIÓN VISUAL - 4A SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "JUEVES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "APLICACIONES ORIENTADAS A SERVICIOS - 5A SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "VIERNES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 2",
      "nombre_curso": "APLICACIONES ORIENTADAS A SERVICIOS - 5A SW",
      "docente": "NUÑEZ MIRANDA CARLOS ISRAEL",
      "dia_semana": "VIERNES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
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
      "nombre_curso": "REDES - 4B SW",
      "docente": "CHANGO SAILEMA WILSON GUSTAVO",
      "dia_semana": "VIERNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
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
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 2A SW",
      "docente": "REYES VASQUEZ JOHN PAUL",
      "dia_semana": "LUNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "APLICACIONES ORIENTADAS A SERVICIOS - 5B SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "APLICACIONES ORIENTADAS A SERVICIOS - 5B SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "AUDITORÍA DE SISTEMAS DE INFORMACIÓN - 7A SW",
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE",
      "dia_semana": "JUEVES",
      "hora_ini": "07:00",
      "hora_fin": "08:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "AUDITORÍA DE SISTEMAS DE INFORMACIÓN - 7A SW",
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE",
      "dia_semana": "JUEVES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "AUDITORÍA DE SISTEMAS DE INFORMACIÓN - 7A SW",
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE",
      "dia_semana": "JUEVES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
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
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 2A SW",
      "docente": "REYES VASQUEZ JOHN PAUL",
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
      "nombre_curso": "DISEÑO DE PROYECTOS - 8A SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
      "dia_semana": "JUEVES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "SISTEMAS DE SOPORTE DE DECISIONES - 5B SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "VIERNES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 3",
      "nombre_curso": "SISTEMAS DE SOPORTE DE DECISIONES - 5B SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "VIERNES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "GESTIÓN DE PROYECTOS DE SOFTWARE - 7A SW",
      "docente": "TORRES ABRIL PAULO CESAR",
      "dia_semana": "LUNES",
      "hora_ini": "07:00",
      "hora_fin": "08:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "GESTIÓN DE PROYECTOS DE SOFTWARE - 7A SW",
      "docente": "TORRES ABRIL PAULO CESAR",
      "dia_semana": "LUNES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "AUDITORÍA DE SISTEMAS DE INFORMACIÓN - 7A SW",
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE",
      "dia_semana": "MIERCOLES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "AUDITORÍA DE SISTEMAS DE INFORMACIÓN - 7A SW",
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE",
      "dia_semana": "MIERCOLES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "GESTIÓN DE PROYECTOS DE SOFTWARE - 7A SW",
      "docente": "TORRES ABRIL PAULO CESAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "GESTIÓN DE PROYECTOS DE SOFTWARE - 7A SW",
      "docente": "TORRES ABRIL PAULO CESAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 4",
      "nombre_curso": "GESTIÓN DE PROYECTOS DE SOFTWARE - 7A SW",
      "docente": "TORRES ABRIL PAULO CESAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
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
      "espacio": "LABORATORIO 4",
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 2B SW",
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL",
      "dia_semana": "JUEVES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "SISTEMAS DE SOPORTE DE DECISIONES - 5B SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "LUNES",
      "hora_ini": "07:00",
      "hora_fin": "08:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "SISTEMAS DE SOPORTE DE DECISIONES - 5B SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "LUNES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "PATRONES DE SOFTWARE - 5B SW",
      "docente": "ALDÁS FLORES CLAY FERNANDO",
      "dia_semana": "LUNES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "PATRONES DE SOFTWARE - 5B SW",
      "docente": "ALDÁS FLORES CLAY FERNANDO",
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
      "nombre_curso": "APLICACIONES ORIENTADAS A SERVICIOS - 5B SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "LUNES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
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
      "nombre_curso": "METODOLOGÍA DE LA INVESTIGACIÓN - 2B SW",
      "docente": "BENITEZ ALDAS MARCOS RAPHAEL",
      "dia_semana": "LUNES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "INTERACCIÓN HUMANO COMPUTADOR - 5B SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "MARTES",
      "hora_ini": "07:00",
      "hora_fin": "08:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "INTERACCIÓN HUMANO COMPUTADOR - 5B SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "MARTES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "INTERACCIÓN HUMANO COMPUTADOR - 5B SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "MARTES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "PATRONES DE SOFTWARE - 5B SW",
      "docente": "ALDÁS FLORES CLAY FERNANDO",
      "dia_semana": "MARTES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "PATRONES DE SOFTWARE - 5B SW",
      "docente": "ALDÁS FLORES CLAY FERNANDO",
      "dia_semana": "MARTES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "PATRONES DE SOFTWARE - 5B SW",
      "docente": "ALDÁS FLORES CLAY FERNANDO",
      "dia_semana": "MARTES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "PATRONES DE SOFTWARE - 5A SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "07:00",
      "hora_fin": "08:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "PATRONES DE SOFTWARE - 5A SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "PATRONES DE SOFTWARE - 5A SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "APLICACIONES ORIENTADAS A SERVICIOS - 5B SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "JUEVES",
      "hora_ini": "07:00",
      "hora_fin": "08:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "APLICACIONES ORIENTADAS A SERVICIOS - 5B SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "JUEVES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "INTERACCIÓN HUMANO COMPUTADOR - 5B SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "JUEVES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 5",
      "nombre_curso": "INTERACCIÓN HUMANO COMPUTADOR - 5B SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
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
      "nombre_curso": "SISTEMAS DE SOPORTE DE DECISIONES - 5B SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "JUEVES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
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
      "nombre_curso": "FUNDAMENTOS DE LA INGENIERÍA DE SOFTWARE - 2B SW",
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE",
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
      "espacio": "LABORATORIO 5",
      "nombre_curso": "FUNDAMENTOS DE LA INGENIERÍA DE SOFTWARE - 2A SW",
      "docente": "IBARRA TORRES OSCAR FERNANDO",
      "dia_semana": "JUEVES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
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
      "nombre_curso": "BASE DE DATOS - 4A SW",
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO",
      "dia_semana": "LUNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "INTRODUCCIÓN A REDES - 3A SW",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "MARTES",
      "hora_ini": "07:00",
      "hora_fin": "08:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "INTRODUCCIÓN A REDES - 3A SW",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "MARTES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "MODELAMIENTO Y DISEÑO DE SOFTWARE - 3B SW",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "MARTES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "MODELAMIENTO Y DISEÑO DE SOFTWARE - 3B SW",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "MARTES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "BASE DE DATOS - 4A SW",
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO",
      "dia_semana": "MARTES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 6",
      "nombre_curso": "BASE DE DATOS - 4A SW",
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO",
      "dia_semana": "MARTES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
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
      "nombre_curso": "BASE DE DATOS - 4A SW",
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO",
      "dia_semana": "JUEVES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "DESARROLLO ASISTIDO POR SOFTWARE - 7A SW",
      "docente": "JARA MOYA SANTIAGO DAVID",
      "dia_semana": "LUNES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "DESARROLLO ASISTIDO POR SOFTWARE - 7A SW",
      "docente": "JARA MOYA SANTIAGO DAVID",
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
      "nombre_curso": "INTELIGENCIA ARTIFICIAL - 7A SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
      "dia_semana": "LUNES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
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
      "nombre_curso": "FUNDAMENTOS DE LA INGENIERÍA DE SOFTWARE - 2B SW",
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE",
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
      "nombre_curso": "METODOLOGÍAS ÁGILES - 4A SW",
      "docente": "NARANJO AVALOS HERNAN FABRICIO",
      "dia_semana": "LUNES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "DESARROLLO ASISTIDO POR SOFTWARE - 7A SW",
      "docente": "JARA MOYA SANTIAGO DAVID",
      "dia_semana": "MARTES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "DESARROLLO ASISTIDO POR SOFTWARE - 7A SW",
      "docente": "JARA MOYA SANTIAGO DAVID",
      "dia_semana": "MARTES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "DESARROLLO ASISTIDO POR SOFTWARE - 7A SW",
      "docente": "JARA MOYA SANTIAGO DAVID",
      "dia_semana": "MARTES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "GESTIÓN DE CALIDAD DEL SOFTWARE - 7A SW",
      "docente": "MAIGUA QUINTEROS ALEX JAVIER",
      "dia_semana": "MARTES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "GESTIÓN DE CALIDAD DEL SOFTWARE - 7A SW",
      "docente": "MAIGUA QUINTEROS ALEX JAVIER",
      "dia_semana": "MARTES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "FUNDAMENTOS DE LA INGENIERÍA DE SOFTWARE - 2B SW",
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE",
      "dia_semana": "MARTES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "FUNDAMENTOS DE LA INGENIERÍA DE SOFTWARE - 2B SW",
      "docente": "BALAREZO LÓPEZ JULIO ENRIQUE",
      "dia_semana": "MARTES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "MANEJO Y CONFIGURACIÓN DEL SOFTWARE - 4B SW",
      "docente": "JARA MOYA SANTIAGO DAVID",
      "dia_semana": "MARTES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "MANEJO Y CONFIGURACIÓN DEL SOFTWARE - 4B SW",
      "docente": "JARA MOYA SANTIAGO DAVID",
      "dia_semana": "MARTES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "GESTIÓN DE PRUEBAS E IMPLANTACIÓN DE SOFTWARE - 6A SW",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "MARTES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "GESTIÓN DE PRUEBAS E IMPLANTACIÓN DE SOFTWARE - 6A SW",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "MARTES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "PROBABILIDAD Y ESTADÍSTICA - 3B SW",
      "docente": "ALDÁS SALAZAR DARWIN SANTIAGO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "07:00",
      "hora_fin": "08:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "PROBABILIDAD Y ESTADÍSTICA - 3B SW",
      "docente": "ALDÁS SALAZAR DARWIN SANTIAGO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "MODELAMIENTO Y DISEÑO DE SOFTWARE - 3A SW",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "MIERCOLES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "MODELAMIENTO Y DISEÑO DE SOFTWARE - 3A SW",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "METODOLOGÍAS ÁGILES - 4A SW",
      "docente": "NARANJO AVALOS HERNAN FABRICIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "METODOLOGÍAS ÁGILES - 4A SW",
      "docente": "NARANJO AVALOS HERNAN FABRICIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "METODOLOGÍAS ÁGILES - 4A SW",
      "docente": "NARANJO AVALOS HERNAN FABRICIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "BASE DE DATOS - 4B SW",
      "docente": "GUACHIMBOZA VILLALBA MARCO VINICIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "BASE DE DATOS - 4B SW",
      "docente": "GUACHIMBOZA VILLALBA MARCO VINICIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "MODELAMIENTO Y DISEÑO DE SOFTWARE - 3A SW",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "JUEVES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "MODELAMIENTO Y DISEÑO DE SOFTWARE - 3A SW",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "JUEVES",
      "hora_ini": "09:00",
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
      "nombre_curso": "INTELIGENCIA ARTIFICIAL - 7A SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
      "dia_semana": "JUEVES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
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
      "nombre_curso": "METODOLOGÍAS ÁGILES - 4B SW",
      "docente": "NARANJO AVALOS HERNAN FABRICIO",
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
      "nombre_curso": "MANEJO Y CONFIGURACIÓN DEL SOFTWARE - 4B SW",
      "docente": "JARA MOYA SANTIAGO DAVID",
      "dia_semana": "JUEVES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "GESTIÓN DE CALIDAD DEL SOFTWARE - 7A SW",
      "docente": "MAIGUA QUINTEROS ALEX JAVIER",
      "dia_semana": "VIERNES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 7",
      "nombre_curso": "GESTIÓN DE CALIDAD DEL SOFTWARE - 7A SW",
      "docente": "MAIGUA QUINTEROS ALEX JAVIER",
      "dia_semana": "VIERNES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
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
      "nombre_curso": "MANEJO Y CONFIGURACIÓN DEL SOFTWARE - 4A SW",
      "docente": "JARA MOYA SANTIAGO DAVID",
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
      "espacio": "LABORATORIO 7",
      "nombre_curso": "METODOLOGÍAS ÁGILES - 4B SW",
      "docente": "NARANJO AVALOS HERNAN FABRICIO",
      "dia_semana": "VIERNES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "SISTEMAS DE SOPORTE DE DECISIONES - 5A SW",
      "docente": "ÁLVAREZ MAYORGA EDISON HOMERO",
      "dia_semana": "LUNES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "SISTEMAS DE SOPORTE DE DECISIONES - 5A SW",
      "docente": "ÁLVAREZ MAYORGA EDISON HOMERO",
      "dia_semana": "LUNES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
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
      "nombre_curso": "BASE DE DATOS - 4B SW",
      "docente": "GUACHIMBOZA VILLALBA MARCO VINICIO",
      "dia_semana": "LUNES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "SISTEMAS DE SOPORTE DE DECISIONES - 5A SW",
      "docente": "ÁLVAREZ MAYORGA EDISON HOMERO",
      "dia_semana": "MARTES",
      "hora_ini": "07:00",
      "hora_fin": "08:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "SISTEMAS DE SOPORTE DE DECISIONES - 5A SW",
      "docente": "ÁLVAREZ MAYORGA EDISON HOMERO",
      "dia_semana": "MARTES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "INTERACCIÓN HUMANO COMPUTADOR - 5A SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "MARTES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "INTERACCIÓN HUMANO / COMPUTADOR - 5A SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "MARTES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "BASE DE DATOS - 4B SW",
      "docente": "GUACHIMBOZA VILLALBA MARCO VINICIO",
      "dia_semana": "MARTES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "BASE DE DATOS - 4B SW",
      "docente": "GUACHIMBOZA VILLALBA MARCO VINICIO",
      "dia_semana": "MARTES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "INTERACCIÓN HUMANO / COMPUTADOR - 5A SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "INTERACCIÓN HUMANO COMPUTADOR - 5A SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "INTERACCIÓN HUMANO / COMPUTADOR - 5A SW",
      "docente": "CAIZA CAIZABUANO JOSE RUBEN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "DISEÑO DE PROYECTOS - 8A SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "DISEÑO DE PROYECTOS - 8A SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "SISTEMAS DE SOPORTE DE DECISIONES - 5A SW",
      "docente": "ÁLVAREZ MAYORGA EDISON HOMERO",
      "dia_semana": "JUEVES",
      "hora_ini": "07:00",
      "hora_fin": "08:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "SISTEMAS DE SOPORTE DE DECISIONES - 5A SW",
      "docente": "ÁLVAREZ MAYORGA EDISON HOMERO",
      "dia_semana": "JUEVES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "PATRONES DE SOFTWARE - 5A SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "JUEVES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LABORATORIO 8",
      "nombre_curso": "PATRONES DE SOFTWARE - 5A SW",
      "docente": "VARGAS PAREDES JAVIER SANTIAGO",
      "dia_semana": "JUEVES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
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
      "espacio": "LABORATORIO 8",
      "nombre_curso": "REDES - 4A SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "VIERNES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
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
      "nombre_curso": "PROGRAMACIÓN ORIENTADA A OBJETOS - 2A SW",
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR",
      "dia_semana": "LUNES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "ESTRUCTURA DE DATOS - 3A SW",
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR",
      "dia_semana": "MARTES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "ESTRUCTURA DE DATOS - 3A SW",
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR",
      "dia_semana": "MARTES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "MODELAMIENTO Y DISEÑO DE SOFTWARE - 3A SW",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "MARTES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "MODELAMIENTO Y DISEÑO DE SOFTWARE - 3A SW",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "MARTES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "FUNDAMENTOS DE LA INGENIERÍA DE SOFTWARE - 2A SW",
      "docente": "IBARRA TORRES OSCAR FERNANDO",
      "dia_semana": "MARTES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "FUNDAMENTOS DE LA INGENIERÍA DE SOFTWARE - 2A SW",
      "docente": "IBARRA TORRES OSCAR FERNANDO",
      "dia_semana": "MARTES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "SISTEMAS OPERATIVOS - 2A SW",
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN",
      "dia_semana": "MARTES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "LAB. CTT",
      "nombre_curso": "SISTEMAS OPERATIVOS - 2A SW",
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN",
      "dia_semana": "MARTES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
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
      "nombre_curso": "SISTEMAS OPERATIVOS - 2A SW",
      "docente": "JEREZ MAYORGA DANIEL SEBASTIAN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
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
      "nombre_curso": "ESTRUCTURA DE DATOS - 3A SW",
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR",
      "dia_semana": "JUEVES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
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
      "nombre_curso": "GESTIÓN DE PRUEBAS E IMPLANTACIÓN DE SOFTWARE - 6A SW",
      "docente": "TORRES VALVERDE LEONARDO DAVID",
      "dia_semana": "JUEVES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
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
      "nombre_curso": "PROGRAMACIÓN ORIENTADA A OBJETOS - 2A SW",
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR",
      "dia_semana": "JUEVES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
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
      "espacio": "LAB. CTT",
      "nombre_curso": "FUNDAMENTOS DE LA INGENIERÍA DE SOFTWARE - 2A SW",
      "docente": "IBARRA TORRES OSCAR FERNANDO",
      "dia_semana": "VIERNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
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
      "nombre_curso": "INTRODUCCIÓN A REDES - 3A SW",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "LUNES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
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
      "nombre_curso": "SEGURIDAD EN EL DESARROLLO DEL SOFTWARE - 8A SW",
      "docente": "IBARRA TORRES OSCAR FERNANDO",
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
      "nombre_curso": "INGENIERÍA ECONÓMICA PARA SOFTWARE - 8A SW",
      "docente": "JARA MOYA SANTIAGO DAVID",
      "dia_semana": "LUNES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "INTRODUCCIÓN A REDES - 3A SW",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "INTRODUCCIÓN A REDES - 3A SW",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "MANEJO Y CONFIGURACIÓN DEL SOFTWARE - 4A SW",
      "docente": "JARA MOYA SANTIAGO DAVID",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "MANEJO Y CONFIGURACIÓN DEL SOFTWARE - 4A SW",
      "docente": "JARA MOYA SANTIAGO DAVID",
      "dia_semana": "MIERCOLES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LAB. REDES 1",
      "nombre_curso": "MANEJO Y CONFIGURACIÓN DEL SOFTWARE - 4A SW",
      "docente": "JARA MOYA SANTIAGO DAVID",
      "dia_semana": "MIERCOLES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
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
      "nombre_curso": "SEGURIDAD EN EL DESARROLLO DEL SOFTWARE - 8A SW",
      "docente": "IBARRA TORRES OSCAR FERNANDO",
      "dia_semana": "JUEVES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
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
      "nombre_curso": "APLICACIONES WEB Y MÓVILES - 6A SW",
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO",
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
      "nombre_curso": "APLICACIONES DISTRIBUIDAS - 6A SW",
      "docente": "MAIGUA QUINTEROS ALEX JAVIER",
      "dia_semana": "LUNES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "APLICACIONES WEB Y MÓVILES - 6A SW",
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO",
      "dia_semana": "MARTES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "APLICACIONES WEB Y MÓVILES - 6A SW",
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO",
      "dia_semana": "MARTES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
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
      "nombre_curso": "APLICACIONES WEB Y MÓVILES - 6A SW",
      "docente": "CHICAIZA CASTILLO DENNIS VINICIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "APLICACIONES DISTRIBUIDAS - 6A SW",
      "docente": "MAIGUA QUINTEROS ALEX JAVIER",
      "dia_semana": "MIERCOLES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LAB. REDES 2",
      "nombre_curso": "APLICACIONES DISTRIBUIDAS - 6A SW",
      "docente": "MAIGUA QUINTEROS ALEX JAVIER",
      "dia_semana": "MIERCOLES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
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
      "espacio": "LAB. REDES 2",
      "nombre_curso": "APLICACIONES DISTRIBUIDAS - 6A SW",
      "docente": "MAIGUA QUINTEROS ALEX JAVIER",
      "dia_semana": "VIERNES",
      "hora_ini": "15:00",
      "hora_fin": "16:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "SEGURIDAD EN EL DESARROLLO DEL SOFTWARE - 8A SW",
      "docente": "IBARRA TORRES OSCAR FERNANDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "SEGURIDAD EN EL DESARROLLO DEL SOFTWARE - 8A SW",
      "docente": "IBARRA TORRES OSCAR FERNANDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "LAB. REDES Y FIBRA ÓPTICA",
      "nombre_curso": "INTRODUCCIÓN A REDES - 3A SW",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "MARTES",
      "hora_ini": "07:00",
      "hora_fin": "08:00"
    },
    {
      "espacio": "LAB. REDES Y FIBRA ÓPTICA",
      "nombre_curso": "INTRODUCCIÓN A REDES - 3A SW",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "MARTES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
    },
    {
      "espacio": "LAB. REDES Y FIBRA ÓPTICA",
      "nombre_curso": "INTRODUCCIÓN A REDES - 3A SW",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "LAB. REDES Y FIBRA ÓPTICA",
      "nombre_curso": "INTRODUCCIÓN A REDES - 3A SW",
      "docente": "URRUTIA URRUTIA ELSA PILAR",
      "dia_semana": "MIERCOLES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
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
      "nombre_curso": "INTRODUCCIÓN A REDES - 3B SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "JUEVES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
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
      "nombre_curso": "REDES - 4B SW",
      "docente": "CHANGO SAILEMA WILSON GUSTAVO",
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
      "espacio": "LAB. REDES Y FIBRA ÓPTICA",
      "nombre_curso": "REDES - 4A SW",
      "docente": "MALDONADO RUIZ DANIEL ALEJANDRO",
      "dia_semana": "VIERNES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "INVESTIGACIÓN OPERATIVA - 5A SW",
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR",
      "dia_semana": "LUNES",
      "hora_ini": "07:00",
      "hora_fin": "08:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "INVESTIGACIÓN OPERATIVA - 5A SW",
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR",
      "dia_semana": "LUNES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "INVESTIGACIÓN OPERATIVA - 5B SW",
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR",
      "dia_semana": "VIERNES",
      "hora_ini": "07:00",
      "hora_fin": "08:00"
    },
    {
      "espacio": "AULA F03",
      "nombre_curso": "INVESTIGACIÓN OPERATIVA - 5B SW",
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR",
      "dia_semana": "VIERNES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "LÓGICA MATEMÁTICA - 1B SW",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "LUNES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "LÓGICA MATEMÁTICA - 1B SW",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "LUNES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "LÓGICA MATEMÁTICA - 1B SW",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
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
      "nombre_curso": "FÍSICA - 1B SW",
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO",
      "dia_semana": "LUNES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "CÁLCULO DIFERENCIAL - 1B SW",
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN",
      "dia_semana": "MARTES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "ÁLGEBRA LINEAL - 1B SW",
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR",
      "dia_semana": "MARTES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "ÁLGEBRA LINEAL - 1B SW",
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR",
      "dia_semana": "MARTES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "ÁLGEBRA LINEAL - 1B SW",
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR",
      "dia_semana": "MARTES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "CÁLCULO DIFERENCIAL - 1B SW",
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "CÁLCULO DIFERENCIAL - 1B SW",
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "FÍSICA - 1B SW",
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "11:00",
      "hora_fin": "12:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "CÁLCULO DIFERENCIAL - 1B SW",
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN",
      "dia_semana": "JUEVES",
      "hora_ini": "07:00",
      "hora_fin": "08:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "CÁLCULO DIFERENCIAL - 1B SW",
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN",
      "dia_semana": "JUEVES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "ÁLGEBRA LINEAL - 1B SW",
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR",
      "dia_semana": "JUEVES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "ÁLGEBRA LINEAL - 1B SW",
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR",
      "dia_semana": "JUEVES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "FÍSICA - 1B SW",
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO",
      "dia_semana": "VIERNES",
      "hora_ini": "07:00",
      "hora_fin": "08:00"
    },
    {
      "espacio": "AULA G04",
      "nombre_curso": "FÍSICA - 1B SW",
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO",
      "dia_semana": "VIERNES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
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
      "nombre_curso": "DISEÑO DE PROYECTOS - 8A SW",
      "docente": "NOGALES PORTERO RUBEN EDUARDO",
      "dia_semana": "JUEVES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "EMPRENDIMIENTO Y LEGISLACIÓN LABORAL - 8A SW",
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA",
      "dia_semana": "MARTES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "EMPRENDIMIENTO Y LEGISLACIÓN LABORAL - 8A SW",
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA",
      "dia_semana": "MARTES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA H05",
      "nombre_curso": "EMPRENDIMIENTO Y LEGISLACIÓN LABORAL - 8A SW",
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA",
      "dia_semana": "MARTES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
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
      "nombre_curso": "EMPRENDIMIENTO Y LEGISLACIÓN LABORAL - 8A SW",
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA",
      "dia_semana": "MIERCOLES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
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
      "nombre_curso": "REALIDAD NACIONAL - 6A SW",
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA",
      "dia_semana": "JUEVES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
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
      "espacio": "AULA H05",
      "nombre_curso": "REALIDAD NACIONAL - 6A SW",
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA",
      "dia_semana": "VIERNES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "FÍSICA - 1A SW",
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO",
      "dia_semana": "LUNES",
      "hora_ini": "07:00",
      "hora_fin": "08:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "FÍSICA - 1A SW",
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO",
      "dia_semana": "LUNES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "FÍSICA - 1A SW",
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO",
      "dia_semana": "LUNES",
      "hora_ini": "09:00",
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
      "nombre_curso": "ÁLGEBRA LINEAL - 1A SW",
      "docente": "REYES BEDOYA DONALD EDUARDO",
      "dia_semana": "LUNES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "CÁLCULO INTEGRAL - 2B SW",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "MARTES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "CÁLCULO INTEGRAL - 2B SW",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "MARTES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "CÁLCULO INTEGRAL - 2B SW",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "14:00",
      "hora_fin": "15:00"
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
      "nombre_curso": "CÁLCULO INTEGRAL - 2B SW",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "16:00",
      "hora_fin": "17:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "LÓGICA MATEMÁTICA - 1A SW",
      "docente": "TORRES ABRIL PAULO CESAR",
      "dia_semana": "JUEVES",
      "hora_ini": "07:00",
      "hora_fin": "08:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "LÓGICA MATEMÁTICA - 1A SW",
      "docente": "TORRES ABRIL PAULO CESAR",
      "dia_semana": "JUEVES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
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
      "nombre_curso": "FÍSICA - 1A SW",
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO",
      "dia_semana": "JUEVES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "CÁLCULO DIFERENCIAL - 1A SW",
      "docente": "CASTRO MAYORGA MARITZA ELIZABETH",
      "dia_semana": "VIERNES",
      "hora_ini": "07:00",
      "hora_fin": "08:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "CÁLCULO DIFERENCIAL - 1A SW",
      "docente": "CASTRO MAYORGA MARITZA ELIZABETH",
      "dia_semana": "VIERNES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
    },
    {
      "espacio": "AULA I01",
      "nombre_curso": "LÓGICA MATEMÁTICA - 1A SW",
      "docente": "TORRES ABRIL PAULO CESAR",
      "dia_semana": "VIERNES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "PROBABILIDAD Y ESTADÍSTICA - 3A SW",
      "docente": "REYES BEDOYA DONALD EDUARDO",
      "dia_semana": "LUNES",
      "hora_ini": "07:00",
      "hora_fin": "08:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "PROBABILIDAD Y ESTADÍSTICA - 3A SW",
      "docente": "REYES BEDOYA DONALD EDUARDO",
      "dia_semana": "LUNES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "MÉTODOS NUMÉRICOS - 3A SW",
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN",
      "dia_semana": "LUNES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "MÉTODOS NUMÉRICOS - 3A SW",
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN",
      "dia_semana": "LUNES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "ÁLGEBRA LINEAL - 1A SW",
      "docente": "REYES BEDOYA DONALD EDUARDO",
      "dia_semana": "MARTES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "ÁLGEBRA LINEAL - 1A SW",
      "docente": "REYES BEDOYA DONALD EDUARDO",
      "dia_semana": "MARTES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "PROBABILIDAD Y ESTADÍSTICA - 3A SW",
      "docente": "REYES BEDOYA DONALD EDUARDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "07:00",
      "hora_fin": "08:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "PROBABILIDAD Y ESTADÍSTICA - 3A SW",
      "docente": "REYES BEDOYA DONALD EDUARDO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "PROBABILIDAD Y ESTADÍSTICA - 3B SW",
      "docente": "ALDÁS SALAZAR DARWIN SANTIAGO",
      "dia_semana": "JUEVES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "PROBABILIDAD Y ESTADÍSTICA - 3B SW",
      "docente": "ALDÁS SALAZAR DARWIN SANTIAGO",
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
      "nombre_curso": "INVESTIGACIÓN OPERATIVA - 5A SW",
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR",
      "dia_semana": "JUEVES",
      "hora_ini": "12:00",
      "hora_fin": "13:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "MÉTODOS NUMÉRICOS - 3A SW",
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN",
      "dia_semana": "VIERNES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA I02",
      "nombre_curso": "MÉTODOS NUMÉRICOS - 3A SW",
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN",
      "dia_semana": "VIERNES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "MÉTODOS NUMÉRICOS - 3B SW",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "MARTES",
      "hora_ini": "07:00",
      "hora_fin": "08:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "MÉTODOS NUMÉRICOS - 3B SW",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "MARTES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "CÁLCULO INTEGRAL - 2A SW",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "MARTES",
      "hora_ini": "18:00",
      "hora_fin": "19:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "CÁLCULO INTEGRAL - 2A SW",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "MARTES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "CÁLCULO DIFERENCIAL - 1A SW",
      "docente": "CASTRO MAYORGA MARITZA ELIZABETH",
      "dia_semana": "MIERCOLES",
      "hora_ini": "08:00",
      "hora_fin": "09:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "CÁLCULO DIFERENCIAL - 1A SW",
      "docente": "CASTRO MAYORGA MARITZA ELIZABETH",
      "dia_semana": "MIERCOLES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "CÁLCULO DIFERENCIAL - 1A SW",
      "docente": "CASTRO MAYORGA MARITZA ELIZABETH",
      "dia_semana": "MIERCOLES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
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
      "nombre_curso": "CÁLCULO INTEGRAL - 2A SW",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "19:00",
      "hora_fin": "20:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "MÉTODOS NUMÉRICOS - 3B SW",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "VIERNES",
      "hora_ini": "09:00",
      "hora_fin": "10:00"
    },
    {
      "espacio": "AULA I03",
      "nombre_curso": "MÉTODOS NUMÉRICOS - 3B SW",
      "docente": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "dia_semana": "VIERNES",
      "hora_ini": "10:00",
      "hora_fin": "11:00"
    }
  ]
};

runSeedHorarios(DATA, { label: 'SOFTWARE' })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = require('./_horarios-runner');
    await prisma.$disconnect();
  });
