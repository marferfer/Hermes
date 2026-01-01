// control-server.js
// Este servidor controla el inicio y detención del servidor principal

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
const CONTROL_PORT = 4000;

let serverProcess = null;

app.use(cors());
app.use(express.json());

// Endpoint para iniciar el servidor
app.post('/start', (req, res) => {
    if (serverProcess) {
        return res.json({ 
            success: false, 
            message: 'El servidor ya está ejecutándose' 
        });
    }

    try {
        // Iniciar el servidor principal
        serverProcess = spawn('node', ['server.js'], {
            stdio: 'inherit'
        });

        serverProcess.on('error', (error) => {
            console.error('Error al iniciar servidor:', error);
            serverProcess = null;
        });

        serverProcess.on('exit', (code) => {
            console.log(`Servidor detenido con código ${code}`);
            serverProcess = null;
        });

        // Dar tiempo para que el servidor inicie
        setTimeout(() => {
            res.json({ 
                success: true, 
                message: 'Servidor iniciado correctamente',
                pid: serverProcess.pid
            });
        }, 1000);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Endpoint para detener el servidor
app.post('/stop', (req, res) => {
    if (!serverProcess) {
        return res.json({ 
            success: false, 
            message: 'El servidor no está ejecutándose' 
        });
    }

    try {
        serverProcess.kill();
        serverProcess = null;
        
        res.json({ 
            success: true, 
            message: 'Servidor detenido correctamente' 
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Endpoint de estado
app.get('/status', (req, res) => {
    res.json({
        controlServerActive: true,
        mainServerActive: serverProcess !== null,
        pid: serverProcess ? serverProcess.pid : null
    });
});

app.listen(CONTROL_PORT, () => {
    console.log(`🎮 Servidor de control escuchando en http://localhost:${CONTROL_PORT}`);
    console.log(`📋 Endpoints disponibles:`);
    console.log(`   POST /start  - Iniciar servidor principal`);
    console.log(`   POST /stop   - Detener servidor principal`);
    console.log(`   GET  /status - Estado de los servidores`);
});

// Manejar cierre del servidor de control
process.on('SIGINT', () => {
    console.log('\n🛑 Cerrando servidor de control...');
    if (serverProcess) {
        serverProcess.kill();
    }
    process.exit(0);
});