const express = require("express");
const cors = require("cors");
require('dotenv').config();
const {PrismaClient} = require("@prisma/client");


const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const authRoutes = require('./routes/auth');
const espaciosRoutes = require('./routes/espacios');
const reservasRoutes = require('./routes/reservas');
const asistenciasRoutes = require('./routes/asistencias');
const documentosRoutes = require('./routes/documentos');

app.use('/api/documentos', documentosRoutes);
app.use('/api/asistencias', asistenciasRoutes);

app.use('/api/reservas', reservasRoutes);

app.use('/api/espacios', espaciosRoutes);
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

app.listen(PORT, () =>{
    console.log(`Servidor escychado en el puerto ${PORT} - localhost:${PORT}/api/status/`);
});