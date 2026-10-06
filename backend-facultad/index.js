const express = require("express");
const cors = require("cors");
const path = require("path");
require('dotenv').config();

const app = express();
const prisma = require('./lib/prisma');
const { iniciarAvisosDeInicio } = require('./utils/avisosTutoria');
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const authRoutes = require('./routes/auth');
const usuariosRoutes = require('./routes/usuarios');
const espaciosRoutes = require('./routes/espacios');
const horariosRoutes = require('./routes/horarios');
const disponibilidadRoutes = require('./routes/disponibilidad');
const reservasRoutes = require('./routes/reservas');
const tutoriasRoutes = require('./routes/tutorias');
const asistenciasRoutes = require('./routes/asistencias');
const documentosRoutes = require('./routes/documentos');
const carrerasRoutes = require('./routes/carreras');
const nivelesRoutes = require('./routes/niveles');
const materiasRoutes = require('./routes/materias');
const paralelosRoutes = require('./routes/paralelos');
const matriculasRoutes = require('./routes/matriculas');
const solicitudesRoutes = require('./routes/solicitudes');
const notificacionesRoutes = require('./routes/notificaciones');

app.use('/api/documentos', documentosRoutes);
app.use('/api/solicitudes', solicitudesRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/carreras', carrerasRoutes);
app.use('/api/niveles', nivelesRoutes);
app.use('/api/materias', materiasRoutes);
app.use('/api/paralelos', paralelosRoutes);
app.use('/api/matriculas', matriculasRoutes);
app.use('/api/asistencias', asistenciasRoutes);
app.use('/api/tutorias', tutoriasRoutes);
app.use('/api/disponibilidad', disponibilidadRoutes);
app.use('/api/horarios', horariosRoutes);
app.use('/api/reservas', reservasRoutes);
app.use('/api/espacios', espaciosRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/auth', authRoutes);

app.get('/api/status/',async (req,res) =>{
    try{
        await prisma.$queryRaw`SELECT 1`;
        res.status(200).json({
                estado:"OK",
                mensaje:"Conexion exitosa a la base de supabase"
            });
    }
    catch(error){
        console.error("Error al conectar a la base de datos:",error);
        res.status(500).json({
            estado:"Error",
            mensaje:"No se pudo conectar con la base de supabase",
        });
    }
    });

// Express 5 pasa al callback el error de arranque (p. ej. puerto ocupado): sin revisarlo,
// se imprimía "Servidor escuchado" y el proceso terminaba sin avisar.
app.listen(PORT, (error) =>{
    if (error) {
        if (error.code === 'EADDRINUSE') {
            console.error(`El puerto ${PORT} ya está en uso: probablemente el backend ya está corriendo en otra terminal. Ciérralo o usa otro puerto (PORT en .env).`);
        } else {
            console.error('No se pudo iniciar el servidor:', error);
        }
        process.exit(1);
    }
    console.log(`Servidor escychado en el puerto ${PORT} - localhost:${PORT}/api/status/`);
    iniciarAvisosDeInicio();
});