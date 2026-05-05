const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;

const multer = require('multer');
const path = require('path');


// 🔥 MULTER CONFIG (ACA ARRIBA)
const storage = multer.diskStorage({
  destination: 'public/uploads',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

const JWT_SECRET = 'clave_super_secreta_paramedicos';

// =======================
// MIDDLEWARES
// =======================
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('public/uploads'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================
// CONEXIÓN MYSQL
// =======================
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'signosvitales'
});

db.connect(err => {
  if (err) {
    console.error('❌ Error MySQL:', err.message);
    return;
  }
  console.log('✅ Conectado a MySQL');
});

// =======================
// MIDDLEWARE SEGURIDAD
// =======================
function verificarToken(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth) return res.status(401).json({ error: 'Token requerido' });

  const token = auth.split(' ')[1];

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Token inválido o expirado' });
    req.usuario = decoded;
    next();
  });
}

function soloRoles(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    next();
  };
}

// =======================
// TEST
// =======================
app.get('/test', (req, res) => {
  res.send('🔥 SERVER FUNCIONANDO OK');
});

// =======================
// REGISTRO USUARIOS (AHORA CON APELLIDO)
// =======================
app.post('/registro', async (req, res) => {
  try {
    const { nombre, apellido, dni, email, password, rol } = req.body;

    if (!nombre || !apellido || !dni || !email || !password || !rol) {
      return res.status(400).json({ error: 'Complete todos los campos' });
    }

    // 🔥 VALIDAR DNI SOLO NÚMEROS
    if (!/^\d+$/.test(dni)) {
      return res.status(400).json({ error: 'El DNI debe contener solo números' });
    }

    const hash = await bcrypt.hash(password, 10);

    const sql = `
      INSERT INTO usuarios (nombre, apellido, dni, email, password, rol)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [nombre, apellido, dni, email, hash, rol], (err, result) => {
      if (err) {
        console.error('Error SQL:', err);
        return res.status(500).json({ error: err.message });
      }

      res.json({ mensaje: '✅ Usuario registrado correctamente' });
    });

  } catch (error) {
    console.error('Error general:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// =======================
// LOGIN
// =======================
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const sql = `SELECT * FROM usuarios WHERE email = ? LIMIT 1`;

  db.query(sql, [email], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Error DB' });
    if (results.length === 0)
      return res.status(401).json({ error: 'Credenciales incorrectas' });

    const usuario = results[0];

    const passwordOK = usuario.password.startsWith('$2')
      ? await bcrypt.compare(password, usuario.password)
      : password === usuario.password;

    if (!passwordOK)
      return res.status(401).json({ error: 'Credenciales incorrectas' });

    const token = jwt.sign(
      { id: usuario.id, nombre: usuario.nombre, apellido: usuario.apellido, rol: usuario.rol },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, nombre: usuario.nombre, apellido: usuario.apellido, rol: usuario.rol });
  });
});

// =======================
// GUARDAR PACIENTE
// =======================
app.post('/guardar', verificarToken, soloRoles('paramedico'), (req, res) => {
  const { nombre, apellido, edad, sexo } = req.body;

  if (!nombre || !apellido) {
    return res.status(400).json({ error: 'Nombre y apellido obligatorios' });
  }

  const sql = `
    INSERT INTO pacientes (nombre, apellido, edad, sexo)
    VALUES (?, ?, ?, ?)
  `;

  db.query(sql, [nombre, apellido, edad || null, sexo || null], (err, result) => {
    if (err) return res.status(500).json({ error: 'Error al guardar paciente' });
    res.json({ mensaje: '✅ Paciente creado', id: result.insertId });
  });
});

// =======================
// GUARDAR SIGNOS VITALES
// =======================
app.post('/registros_signos', verificarToken, soloRoles('paramedico'), (req, res) => {
  const usuario_id = req.usuario.id;

  const {
    paciente_id,
    presion_arterial,
    frecuencia_cardiaca,
    frecuencia_respiratoria,
    spo2,
    temperatura,
    observaciones
  } = req.body;

  const sql = `
    INSERT INTO registros_signos (
      paciente_id,
      presion_arterial,
      frecuencia_cardiaca,
      frecuencia_respiratoria,
      spo2,
      temperatura,
      observaciones,
      usuario_id,
      fecha_hora
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `;

  db.query(sql, [
    paciente_id,
    presion_arterial,
    frecuencia_cardiaca,
    frecuencia_respiratoria,
    spo2 || null,
    temperatura,
    observaciones || null,
    usuario_id
  ], err => {
    if (err) return res.status(500).json({ error: 'Error al guardar signos' });
    res.json({ mensaje: '✅ Signos vitales registrados' });
  });
});

// =======================
// LISTAR PACIENTES
// =======================
app.get('/pacientes', verificarToken, soloRoles('paramedico', 'profesor', 'coordinador'), (req, res) => {
  const sql = `
    SELECT id, nombre, apellido, CONCAT(apellido, ' ', nombre) AS apellido_nombre, edad, sexo
    FROM pacientes
    ORDER BY apellido ASC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: 'Error al obtener pacientes' });
    res.json(results);
  });
});

// =======================
// HISTORIAL SIGNOS
// =======================
app.get('/registros_signos/:paciente_id', verificarToken, soloRoles('paramedico', 'profesor', 'coordinador'), (req, res) => {
  const { paciente_id } = req.params;

  const sql = `
    SELECT
      DATE(r.fecha_hora) AS fecha,
      TIME(r.fecha_hora) AS hora_control,
      r.presion_arterial,
      r.frecuencia_respiratoria,
      r.frecuencia_cardiaca,
      r.spo2,
      r.temperatura,
      r.observaciones,
      COALESCE(u.nombre, 'No registrado') AS registrado_por
    FROM registros_signos r
    LEFT JOIN usuarios u ON r.usuario_id = u.id
    WHERE r.paciente_id = ?
    ORDER BY r.fecha_hora DESC
  `;

  db.query(sql, [paciente_id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error al obtener historial' });
    res.json(results);
  });
});

// =======================
// DASHBOARD RESUMEN
// =======================
app.get('/dashboard/resumen', verificarToken, (req, res) => {
  const resumen = {};

  db.query(`SELECT COUNT(*) AS total FROM pacientes`, (err, result1) => {
    if (err) return res.status(500).json({ error: 'Error total pacientes' });

    resumen.total_pacientes = result1[0].total;

    db.query(`SELECT COUNT(*) AS total FROM registros_signos WHERE DATE(fecha_hora) = CURDATE()`, (err, result2) => {
      if (err) return res.status(500).json({ error: 'Error controles hoy' });

      resumen.controles_hoy = result2[0].total;

      db.query(`
        SELECT CONCAT(p.apellido, ' ', p.nombre) AS apellido_nombre
        FROM registros_signos r
        JOIN pacientes p ON r.paciente_id = p.id
        ORDER BY r.fecha_hora DESC
        LIMIT 1
      `, (err, result3) => {
        if (err) return res.status(500).json({ error: 'Error último registro' });

        resumen.ultimo_registro = result3[0] || null;

        res.json(resumen);
      });
    });
  });
});

// =======================
// DASHBOARD ALERTAS
// =======================
app.get('/dashboard/alertas', verificarToken, (req, res) => {
  const sql = `
    SELECT 
      CONCAT(p.apellido, ' ', p.nombre) AS apellido_nombre,
      r.frecuencia_cardiaca,
      r.frecuencia_respiratoria,
      r.spo2,
      r.temperatura,
      r.fecha_hora
    FROM registros_signos r
    JOIN pacientes p ON r.paciente_id = p.id
    WHERE
      (r.frecuencia_cardiaca > 120 OR r.frecuencia_cardiaca < 50)
      OR
      (r.frecuencia_respiratoria > 30 OR r.frecuencia_respiratoria < 8)
      OR
      (r.spo2 IS NOT NULL AND r.spo2 < 90)
      OR
      (r.temperatura > 38.5)
    ORDER BY r.fecha_hora DESC
    LIMIT 20
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: 'Error alertas' });
    res.json(results);
  });
});

// =======================
// LISTAR TODOS LOS REGISTROS (PROFESOR / COORDINADOR)
// =======================
app.get('/registros_signos', verificarToken, soloRoles('profesor','coordinador'), (req, res) => {
  const sql = `
    SELECT
      r.id,
      r.paciente_id,
      CONCAT(p.apellido, ' ', p.nombre) AS paciente,
      p.sexo,
      DATE(r.fecha_hora) AS fecha,
      TIME(r.fecha_hora) AS hora_control,
      r.presion_arterial,
      r.frecuencia_respiratoria,
      r.frecuencia_cardiaca,
      r.spo2,
      r.temperatura,
      r.observaciones,
      u.nombre AS usuario_nombre,
      u.apellido AS usuario_apellido,
      u.rol AS rol_usuario
    FROM registros_signos r
    JOIN pacientes p ON r.paciente_id = p.id
    LEFT JOIN usuarios u ON r.usuario_id = u.id
    ORDER BY r.fecha_hora DESC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: 'Error al obtener registros' });

    // 🔥 ARMAMOS EL OBJETO COMPLETO
    const data = results.map(r => ({
      ...r,
      registrado_por: {
        nombre: r.usuario_nombre || 'No',
        apellido: r.usuario_apellido || 'registrado'
      }
    }));

    res.json(data);
  });
});

// =======================
// ENDPOINT /USUARIOS
// =======================
app.get('/usuarios', (req, res) => {
const sql = `
    SELECT id, nombre, apellido, dni, email, rol,
           CONCAT(apellido, ' ', nombre) AS apellido_nombre
    FROM usuarios
    WHERE rol IN ('coordinador','paramedico','profesor')
    ORDER BY apellido ASC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: 'Error al obtener usuarios' });
    res.json(results);
  });
});

app.delete('/usuarios/:id', verificarToken, soloRoles('profesor'), (req, res) => {
  const id = parseInt(req.params.id);

  const sql = `DELETE FROM usuarios WHERE id = ?`;
  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Error al eliminar usuario' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ mensaje: '✅ Usuario eliminado' });
  });
});


// =======================
// RUTA APORTES (POST)
// =======================
app.post('/aportes', upload.single('comprobante'), (req, res) => {
  const { usuario_id, monto, tipo_pago } = req.body;
  const comprobante = req.file ? req.file.filename : null;

  const sql = `
    INSERT INTO aportes (usuario_id, monto, tipo_pago, comprobante)
    VALUES (?, ?, ?, ?)
  `;

  db.query(sql, [usuario_id, monto, tipo_pago, comprobante], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al guardar' });
    }

    res.json({ mensaje: 'Aporte guardado correctamente' });
  });
});

// =======================
// LIMPIAR PACIENTES (PROFESOR)
// =======================
app.delete('/limpiar-pacientes', verificarToken, soloRoles('profesor'), (req, res) => {
  const sql1 = `DELETE FROM registros_signos`;
  const sql2 = `DELETE FROM pacientes`;

  db.query(sql1, err => {
    if (err) return res.status(500).json({ error: 'Error al borrar registros' });

    db.query(sql2, err2 => {
      if (err2) return res.status(500).json({ error: 'Error al borrar pacientes' });

      res.json({ mensaje: '🧹 Todos los pacientes y registros fueron eliminados' });
    });
  });
});

// =======================
// NUEVO ENDPOINT /ASISTENCIA (CORREGIDO)
// =======================
app.post('/asistencia', verificarToken, soloRoles('profesor','coordinador'), (req, res) => {
  const { usuario_id, dni, fecha, presente } = req.body;

  if (!usuario_id || !fecha || typeof presente !== 'boolean') {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  const sql = `
    INSERT INTO asistencias (usuario_id, fecha, presente)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE presente = VALUES(presente)
  `;

  db.query(sql, [usuario_id, fecha, presente ? 1 : 0], (err, result) => {
    if (err) {
      console.error('Error asistencia:', err);
      return res.status(500).json({ error: 'Error al guardar asistencia' });
    }

    res.json({ mensaje: '✅ Asistencia registrada' });
  });
});

// =======================
// OBTENER TODA LA ASISTENCIA 🔥 (FALTABA - ARREGLA EL 404)
// =======================
app.get('/asistencia', verificarToken, soloRoles('profesor','coordinador'), (req, res) => {

  const sql = `
    SELECT 
      a.id,
      a.fecha,
      a.presente,
      u.id as usuario_id,
      u.nombre,
      u.apellido,
      u.rol,
      CONCAT(u.apellido, ' ', u.nombre) AS apellido_nombre
    FROM asistencias a
    JOIN usuarios u ON a.usuario_id = u.id
    ORDER BY a.fecha DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error asistencia general:', err);
      return res.status(500).json({ error: 'Error al obtener asistencia' });
    }

    const data = results.map(r => ({
      ...r,
      presente: r.presente === 1
    }));

    res.json(data);
  });
});


// =======================
// 🚨 ALERTAS BACKEND (3 FALTAS SEGUIDAS)
// =======================
app.get('/asistencia/alertas', verificarToken, soloRoles('profesor','coordinador'), (req, res) => {

  const sql = `
    SELECT 
      usuario_id,
      COUNT(*) as faltas
    FROM asistencias
    WHERE presente = 0
    GROUP BY usuario_id
    HAVING faltas >= 3
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error alertas asistencia:', err);
      return res.status(500).json({ error: 'Error alertas' });
    }

    res.json(results);
  });
});


// =======================
// 🏆 RANKING PARAMEDICOS
// =======================
app.get('/asistencia/ranking', verificarToken, soloRoles('profesor','coordinador'), (req, res) => {

  const sql = `
    SELECT 
      u.id,
      CONCAT(u.apellido, ' ', u.nombre) AS nombre,
      COUNT(a.id) AS asistencias
    FROM asistencias a
    JOIN usuarios u ON a.usuario_id = u.id
    WHERE a.presente = 1
      AND u.rol = 'paramedico'
    GROUP BY u.id
    ORDER BY asistencias DESC
    LIMIT 10
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error ranking:', err);
      return res.status(500).json({ error: 'Error ranking' });
    }

    res.json(results);
  });
});

// =======================
// OBTENER ASISTENCIA POR FECHA 🔥 (CORREGIDO)
// =======================
app.get('/asistencia/:fecha', verificarToken, soloRoles('profesor','coordinador'), (req, res) => {
  const { fecha } = req.params;

  const sql = `
    SELECT 
      u.id,
      u.nombre,
      u.apellido,
      u.rol,
      a.presente,
      a.fecha,
      CONCAT(u.apellido, ' ', u.nombre) AS apellido_nombre
    FROM usuarios u
    LEFT JOIN asistencias a 
      ON u.id = a.usuario_id AND a.fecha = ?
    WHERE u.rol IN ('coordinador','paramedico','profesor') -- 🔥 AGREGADO PROFESOR
    ORDER BY 
      FIELD(u.rol, 'coordinador', 'profesor', 'paramedico'),
      u.apellido ASC
  `;

  db.query(sql, [fecha], (err, results) => {
    if (err) {
      console.error('Error al obtener asistencia:', err);
      return res.status(500).json({ error: 'Error al obtener asistencia' });
    }

    const data = results.map(u => ({
      ...u,
      presente: u.presente === 1
    }));

    res.json(data);
  });
});


// =======================
// HISTORIAL DE ASISTENCIA 🔥
// =======================
app.get('/asistencia/historial', verificarToken, soloRoles('profesor','coordinador'), (req, res) => {

  const sql = `
    SELECT 
      a.id,
      a.fecha,
      a.presente,
      u.id as usuario_id,
      u.nombre,
      u.apellido,
      u.rol,
      CONCAT(u.apellido, ' ', u.nombre) AS apellido_nombre
    FROM asistencias a
    JOIN usuarios u ON a.usuario_id = u.id
    ORDER BY a.fecha DESC, u.apellido ASC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error historial:', err);
      return res.status(500).json({ error: 'Error al obtener historial' });
    }

    res.json(results);
  });
});


// =======================
// ESTADÍSTICAS POR MES 🔥
// =======================
app.get('/asistencia/estadisticas/:anio/:mes', verificarToken, soloRoles('profesor','coordinador'), (req, res) => {

  const { anio, mes } = req.params;

  const sql = `
    SELECT 
      u.id,
      CONCAT(u.apellido, ' ', u.nombre) AS apellido_nombre,
      u.rol,
      COUNT(a.id) AS total_clases,
      SUM(a.presente = 1) AS presentes,
      SUM(a.presente = 0) AS ausentes
    FROM usuarios u
    LEFT JOIN asistencias a 
      ON u.id = a.usuario_id 
      AND YEAR(a.fecha) = ? 
      AND MONTH(a.fecha) = ?
    WHERE u.rol IN ('coordinador','paramedico','profesor')
    GROUP BY u.id
    ORDER BY u.apellido ASC
  `;

  db.query(sql, [anio, mes], (err, results) => {
    if (err) {
      console.error('Error estadisticas:', err);
      return res.status(500).json({ error: 'Error en estadísticas' });
    }

    res.json(results);
  });
});


// =======================
// CALENDARIO DE ASISTENCIA 🔥
// =======================
app.get('/asistencia/calendario/:usuario_id', verificarToken, (req, res) => {

  const { usuario_id } = req.params;

  const sql = `
    SELECT 
      fecha,
      presente
    FROM asistencias
    WHERE usuario_id = ?
    ORDER BY fecha ASC
  `;

  db.query(sql, [usuario_id], (err, results) => {
    if (err) {
      console.error('Error calendario:', err);
      return res.status(500).json({ error: 'Error calendario' });
    }

    res.json(results);
  });
});



app.get('/aportes', (req, res) => {
    const sql = `
        SELECT a.*, u.nombre 
        FROM aportes a
        JOIN usuarios u ON a.usuario_id = u.id
        ORDER BY a.fecha DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al obtener aportes');
        } else {
            res.json(results);
        }
    });
});

// =======================
// CALENDARIO DE APORTES (FUNCION JS PARA FRONTEND, SE DEJA COMO REFERENCIA)
// =======================

function generarCalendario(aportes) {
    const calendarioDiv = document.getElementById('calendario');
    calendarioDiv.innerHTML = '';

    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const aportesPorMes = {};

    aportes.forEach(aporte => {
        const fecha = new Date(aporte.fecha);
        const mes = fecha.getMonth();

        if (!aportesPorMes[mes]) {
            aportesPorMes[mes] = [];
        }

        aportesPorMes[mes].push(aporte);
    });

    meses.forEach((mesNombre, index) => {
        const div = document.createElement('div');

        const tieneAporte = aportesPorMes[index];

        div.innerHTML = `
            <div style="padding:10px; margin:5px; border-radius:8px; 
                background:${tieneAporte ? '#4CAF50' : '#f44336'};
                color:white; cursor:pointer;">
                ${mesNombre} ${tieneAporte ? '✅' : '❌'}
            </div>
        `;

        if (tieneAporte) {
            div.onclick = () => {
                mostrarDetalleMes(mesNombre, aportesPorMes[index]);
            };
        }

        calendarioDiv.appendChild(div);
    });
}





// =======================
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});