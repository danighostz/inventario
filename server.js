const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configuración de PostgreSQL - CORREGIDA
const pool = new Pool({
    user: 'inventario_user',
    host: 'localhost',
    database: 'inventario_db',
    password: 'Equipomena7',
    port: 5432,
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Inicializar base de datos
async function initDB() {
    try {
        // Tabla de usuarios
        await pool.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Tabla de productos
        await pool.query(`
            CREATE TABLE IF NOT EXISTS productos (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                descripcion TEXT,
                categoria VARCHAR(50) NOT NULL,
                precio DECIMAL(10,2) NOT NULL,
                cantidad INTEGER NOT NULL,
                proveedor VARCHAR(100),
                usuario_id INTEGER REFERENCES usuarios(id),
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('✅ Base de datos inicializada correctamente');
    } catch (error) {
        console.error('❌ Error al inicializar la base de datos:', error.message);
    }
}

// ===== MIDDLEWARE DE AUTENTICACIÓN =====
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token de acceso requerido' });
    }

    try {
        const user = JSON.parse(Buffer.from(token, 'base64').toString());
        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Token inválido' });
    }
}

// ===== RUTAS DE AUTENTICACIÓN =====
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const userExists = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
        
        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: 'El usuario ya existe' });
        }

        const result = await pool.query(
            'INSERT INTO usuarios (nombre, email, password) VALUES ($1, $2, $3) RETURNING id, nombre, email',
            [name, email, password]
        );

        const user = result.rows[0];
        const token = Buffer.from(JSON.stringify(user)).toString('base64');

        res.json({
            user: {
                id: user.id,
                name: user.nombre,
                email: user.email
            },
            token: token
        });

    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query(
            'SELECT id, nombre, email, password FROM usuarios WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Usuario no encontrado' });
        }

        const user = result.rows[0];

        if (password !== user.password) {
            return res.status(400).json({ error: 'Contraseña incorrecta' });
        }

        const token = Buffer.from(JSON.stringify({
            id: user.id,
            name: user.nombre,
            email: user.email
        })).toString('base64');

        res.json({
            user: {
                id: user.id,
                name: user.nombre,
                email: user.email
            },
            token: token
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ===== RUTAS DEL DASHBOARD =====
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const totalProducts = await pool.query(
            'SELECT COUNT(*) FROM productos WHERE usuario_id = $1',
            [userId]
        );

        const lowStock = await pool.query(
            'SELECT COUNT(*) FROM productos WHERE usuario_id = $1 AND cantidad <= 5 AND cantidad > 0',
            [userId]
        );

        const outOfStock = await pool.query(
            'SELECT COUNT(*) FROM productos WHERE usuario_id = $1 AND cantidad = 0',
            [userId]
        );

        const totalValue = await pool.query(
            'SELECT COALESCE(SUM(precio * cantidad), 0) as total FROM productos WHERE usuario_id = $1',
            [userId]
        );

        res.json({
            totalProducts: parseInt(totalProducts.rows[0].count),
            lowStock: parseInt(lowStock.rows[0].count),
            outOfStock: parseInt(outOfStock.rows[0].count),
            totalValue: parseFloat(totalValue.rows[0].total)
        });

    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ===== RUTAS DE PRODUCTOS =====
app.get('/api/products', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            'SELECT * FROM productos WHERE usuario_id = $1 ORDER BY id DESC',
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error obteniendo productos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.post('/api/products', authenticateToken, async (req, res) => {
    const { nombre, descripcion, categoria, precio, cantidad, proveedor } = req.body;
    const userId = req.user.id;

    try {
        const result = await pool.query(
            'INSERT INTO productos (nombre, descripcion, categoria, precio, cantidad, proveedor, usuario_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [nombre, descripcion, categoria, precio, cantidad, proveedor, userId]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error agregando producto:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const result = await pool.query(
            'DELETE FROM productos WHERE id = $1 AND usuario_id = $2',
            [id, userId]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json({ message: 'Producto eliminado correctamente' });
    } catch (error) {
        console.error('Error eliminando producto:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Health check
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'OK', database: 'Conectado' });
    } catch (error) {
        res.json({ status: 'Error', database: error.message });
    }
});

// Servir archivos HTML
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Iniciar servidor
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Servidor de INVENTARIO PRO corriendo en: http://localhost:${PORT}`);
        console.log(`🔐 Sistema de autenticación activado`);
        console.log(`📊 Dashboard disponible en: http://localhost:${PORT}/index.html`);
    });
});