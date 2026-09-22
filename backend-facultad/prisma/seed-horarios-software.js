// ============================================================================
// ⚠️  SCRIPT DESTRUCTIVO-SEGURO DE CARGA (no borra nada, solo inserta) ⚠️
// Carga el horario de SOLO SOFTWARE de la FISEI (periodo JULIO - DICIEMBRE 2026),
// extraído automáticamente de Horarios-Fisei.pdf con coordenadas de texto
// (PyMuPDF) agrupando por posición de columna (día) y fila (hora) y por
// tamaño de fuente (los nombres de docente se imprimen en fuente más chica
// que la materia/código en el PDF original, lo que permitió separarlos de
// forma confiable).
//
// Ejecutar desde la carpeta backend-facultad:
//   node prisma/seed-horarios-software.js
//
// Es idempotente (usa upserts / búsquedas por nombre antes de crear), así que
// se puede correr varias veces sin duplicar filas.
//
// ---------------------------------------------------------------------------
// SUPUESTOS Y AMBIGÜEDADES A REVISAR (ver también el reporte final del chat):
// ---------------------------------------------------------------------------
// 1. Carreras "TI" e "IT": el usuario confirmó que son DOS carreras
//    distintas — "IT" = Telecomunicaciones, "TI" = Tecnologías de la
//    Información — y en seed-horarios-completo.js ya se separaron según el
//    código literalmente impreso en cada celda del PDF. Este archivo
//    (SOLO SOFTWARE) no contiene ninguna celda con código "TI" ni "IT"
//    (DATA.carreras aquí es únicamente "Software"), así que no aplica
//    ningún cambio de reclasificación en este archivo.
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
//     el texto repetido/concatenado). Eran sesiones consecutivas SIN docente
//     impreso en el PDF (el extractor no pudo saber dónde terminaba una hora
//     y empezaba la siguiente), a petición del usuario se eliminaron
//     totalmente de DATA.materias, DATA.paralelos y DATA.horarios — no debe
//     quedar ningún rastro de esta "materia" en el script.
// 13. Duplicados por acentuación inconsistente en el propio PDF (ej.
//     "ADMINISTRACION DE LA PRODUCCIÓN" sin tilde en una hoja y
//     "ADMINISTRACIÓN DE LA PRODUCCIÓN" con tilde en otra; "CIRCUITOS
//     ELECTRONICOS" / "CIRCUITOS ELECTRÓNICOS") NO se fusionaron
//     automáticamente por miedo a mezclar materias distintas por error:
//     pueden quedar como Materia duplicada en la base. Revisar y fusionar
//     manualmente si corresponde.
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
      "nom_niv": "Octavo Semestre",
      "carrera": "Software",
      "numero": 8
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
      "nom_niv": "Séptimo Semestre",
      "carrera": "Software",
      "numero": 7
    }
  ],
  "materias": [
    "ADMINISTRACIÓN DE BASE DE DATOS",
    "ADMINISTRACIÓN DE REDES",
    "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN",
    "ANÁLISIS DE CIRCUITOS",
    "APLICACIONES DISTRIBUIDAS",
    "APLICACIONES MÓVILES",
    "APLICACIONES ORIENTADAS A SERVICIOS",
    "APLICACIONES WEB Y MÓVILES",
    "AUDITORÍA DE SISTEMAS DE INFORMACIÓN",
    "AUDITORÍA DE TI",
    "BASE DE DATOS",
    "COMPUTACIÓN VISUAL",
    "COMUNICACIÓN ANALÓGICA",
    "CONMUTACIÓN Y ENRUTAMIENTO AVANZADO",
    "CÁLCULO DIFERENCIAL",
    "CÁLCULO INTEGRAL",
    "DESARROLLO ASISTIDO POR SOFTWARE",
    "DISEÑO DE PROYECTOS",
    "DISEÑO Y ORGANIZACIÓN DE PLANTAS",
    "ELECTROMAGNETISMO",
    "EMPRENDIMIENTO Y GESTIÓN FINANCIERA",
    "EMPRENDIMIENTO Y LEGISLACIÓN LABORAL",
    "ESTRUCTURA DE DATOS",
    "FUNDAMENTOS DE LA INGENIERÍA DE SOFTWARE",
    "FUNDAMENTOS DE PROGRAMACIÓN",
    "FUNDAMENTOS DE REDES Y COMUNICACIÓN DE DATOS",
    "FÍSICA",
    "GESTIÓN DE BASE DE DATOS",
    "GESTIÓN DE CALIDAD",
    "GESTIÓN DE CALIDAD DEL SOFTWARE",
    "GESTIÓN DE PROYECTOS DE SOFTWARE",
    "GESTIÓN DE PRUEBAS E IMPLANTACIÓN DE SOFTWARE",
    "GESTIÓN Y EVALUACIÓN DE PROYECTOS TI",
    "INGENIERÍA DE SOFTWARE",
    "INGENIERÍA ECONÓMICA PARA SOFTWARE",
    "INTEGRACIÓN DE SISTEMAS",
    "INTELIGENCIA ARTIFICIAL",
    "INTELIGENCIA DE NEGOCIOS",
    "INTERACCIÓN HOMBRE MÁQUINA",
    "INTERACCIÓN HUMANO / COMPUTADOR",
    "INTERACCIÓN HUMANO COMPUTADOR",
    "INTRODUCCIÓN A REDES",
    "INVESTIGACIÓN OPERATIVA",
    "LÓGICA MATEMÁTICA",
    "MANEJO Y CONFIGURACIÓN DEL SOFTWARE",
    "METODOLOGÍA DE LA INVESTIGACIÓN",
    "METODOLOGÍAS ÁGILES",
    "MODELAMIENTO Y DISEÑO DE SOFTWARE",
    "MÉTODOS NUMÉRICOS",
    "PATRONES DE SOFTWARE",
    "PROBABILIDAD Y ESTADÍSTICA",
    "PROCESAMIENTO DIGITAL DE SEÑALES",
    "PROGRAMACIÓN",
    "PROGRAMACIÓN ORIENTADA A OBJETOS",
    "REALIDAD NACIONAL",
    "REDES",
    "SEGURIDAD EN EL DESARROLLO DEL SOFTWARE",
    "SISTEMAS DE BASE DE DATOS DISTRIBUIDOS",
    "SISTEMAS DE SOPORTE DE DECISIONES",
    "SISTEMAS INALÁMBRICOS",
    "SISTEMAS OPERATIVOS",
    "SOFTWARE DE SIMULACIÓN",
    "TECNOLOGÍAS DEL APRENDIZAJE",
    "TECNOLOGÍAS Y DESARROLLO WEB",
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
      "nombreCompleto": "CUJI RODRIGUEZ JULIO ENRIQUE",
      "nombres": "Julio Enrique",
      "apellidos": "Cuji Rodriguez",
      "cedula": "1800000182",
      "correo": "cuji.enrique@uta.edu.ec"
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
      "nombreCompleto": "GUACHIMBOZA VILLALBA MARCO VINICIO",
      "nombres": "Marco Vinicio",
      "apellidos": "Guachimboza Villalba",
      "cedula": "1800000265",
      "correo": "guachimboza.vinicio@uta.edu.ec"
    },
    {
      "nombreCompleto": "GUAMÁN MOLINA JESÚS ISRAEL",
      "nombres": "Jesus Israel",
      "apellidos": "Guaman Molina",
      "cedula": "1800000281",
      "correo": "guaman.israel1@uta.edu.ec"
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
      "nombreCompleto": "PEÑAFIEL GAIBOR VICTOR FILIBERTO",
      "nombres": "Victor Filiberto",
      "apellidos": "Penafiel Gaibor",
      "cedula": "1800000547",
      "correo": "penafiel.filiberto@uta.edu.ec"
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
      "nombreCompleto": "RUIZ BANDA JAIME BOLIVAR",
      "nombres": "Jaime Bolivar",
      "apellidos": "Ruiz Banda",
      "cedula": "1800000604",
      "correo": "ruiz.bolivar@uta.edu.ec"
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
      "nombreCompleto": "URRUTIA URRUTIA ELSA PILAR",
      "nombres": "Elsa Pilar",
      "apellidos": "Urrutia Urrutia",
      "cedula": "1800000737",
      "correo": "urrutia.pilar@uta.edu.ec"
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
      "nombreCompleto": "VARGAS PAREDES JAVIER SANTIAGO",
      "nombres": "Javier Santiago",
      "apellidos": "Vargas Paredes",
      "cedula": "1800000786",
      "correo": "vargas.santiago@uta.edu.ec"
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
      "materia": "PROGRAMACIÓN",
      "carrera": "Software",
      "nivelNumero": 8,
      "docente": "RUIZ BANDA JAIME BOLIVAR"
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
      "nom_par": "B",
      "materia": "ALGORITMOS Y LÓGICA DE PROGRAMACIÓN",
      "carrera": "Software",
      "nivelNumero": 1,
      "docente": "CAIZA CAIZABUANO JOSE RUBEN"
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
      "materia": "METODOLOGÍA DE LA INVESTIGACIÓN",
      "carrera": "Software",
      "nivelNumero": 2,
      "docente": "REYES VASQUEZ JOHN PAUL"
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
      "nom_par": "B",
      "materia": "PATRONES DE SOFTWARE",
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
      "materia": "GESTIÓN DE BASE DE DATOS",
      "carrera": "Software",
      "nivelNumero": 4,
      "docente": "BUENAÑO VALENCIA EDWIN HERNANDO"
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
      "materia": "PROGRAMACIÓN ORIENTADA A OBJETOS",
      "carrera": "Software",
      "nivelNumero": 2,
      "docente": "FERNÁNDEZ PEÑA FÉLIX OSCAR"
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
      "materia": "FUNDAMENTOS DE REDES Y COMUNICACIÓN DE DATOS",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "URRUTIA URRUTIA ELSA PILAR"
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
      "materia": "DISEÑO DE PROYECTOS",
      "carrera": "Software",
      "nivelNumero": 6,
      "docente": "MAYORGA MAYORGA FRANKLIN OSWALDO"
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
      "nom_par": "B",
      "materia": "INVESTIGACIÓN OPERATIVA",
      "carrera": "Software",
      "nivelNumero": 5,
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR"
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
      "nom_par": "B",
      "materia": "CÁLCULO DIFERENCIAL",
      "carrera": "Software",
      "nivelNumero": 1,
      "docente": "SOLIS SALAZAR JUAN SEBASTIÁN"
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
      "materia": "EMPRENDIMIENTO Y LEGISLACIÓN LABORAL",
      "carrera": "Software",
      "nivelNumero": 8,
      "docente": "CAZORLA LOGROÑO MARIA FRANCISCA"
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
      "carrera": "Software",
      "nivelNumero": 1,
      "docente": "REYES BEDOYA DONALD EDUARDO"
    },
    {
      "nom_par": "B",
      "materia": "PROBABILIDAD Y ESTADÍSTICA",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "ALDÁS SALAZAR DARWIN SANTIAGO"
    },
    {
      "nom_par": "B",
      "materia": "CÁLCULO DIFERENCIAL",
      "carrera": "Software",
      "nivelNumero": 3,
      "docente": "CASTRO MAYORGA MARITZA ELIZABETH"
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
      "nombre_curso": "INTELIGENCIA DE NEGOCIOS - 5A SW",
      "docente": "ÁLVAREZ MAYORGA EDISON HOMERO",
      "dia_semana": "MIERCOLES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
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
      "espacio": "LAB. ROBÓTICA Y REDES INDUSTRIALES",
      "nombre_curso": "DISEÑO Y ORGANIZACIÓN DE PLANTAS - 8A SW",
      "docente": "NARANJO CHIRIBOGA ISRAEL ERNESTO",
      "dia_semana": "JUEVES",
      "hora_ini": "17:00",
      "hora_fin": "18:00"
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
      "nombre_curso": "INVESTIGACIÓN OPERATIVA - 5B SW",
      "docente": "ORTIZ FERNÁNDEZ WILLIAM WLADIMIR",
      "dia_semana": "VIERNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
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
      "nombre_curso": "FÍSICA - 1B SW",
      "docente": "SANTAMARIA VILLACIS MARLON ANTONIO",
      "dia_semana": "VIERNES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
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
      "espacio": "AULA I03",
      "nombre_curso": "CÁLCULO DIFERENCIAL - 3B SW",
      "docente": "CASTRO MAYORGA MARITZA ELIZABETH",
      "dia_semana": "MIERCOLES",
      "hora_ini": "7:00",
      "hora_fin": "8:00"
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

runSeedHorarios(DATA, { label: 'SOLO SOFTWARE' })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = require('./_horarios-runner');
    await prisma.$disconnect();
  });
