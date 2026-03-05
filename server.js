const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;

const JWT_SECRET = 'clave_super_secreta_paramedicos';

// =======================
// MIDDLEWARES
// =======================
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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
// REGISTRO USUARIOS
// =======================
app.post('/registro', async (req, res) => {
  const { nombre, email, password, rol } = req.body;

  if (!nombre || !email || !password || !rol) {
    return res.status(400).json({ error: 'Complete todos los campos' });
  }

  const hash = await bcrypt.hash(password, 10);

  const sql = `
    INSERT INTO usuarios (nombre, email, password, rol)
    VALUES (?, ?, ?, ?)
  `;

  db.query(sql, [nombre, email, hash, rol], err => {
    if (err) return res.status(500).json({ error: 'Error al registrar usuario' });
    res.json({ mensaje: '✅ Usuario registrado' });
  });
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
      { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, nombre: usuario.nombre, rol: usuario.rol });
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

  db.query(
    sql,
    [nombre, apellido, edad || null, sexo || null],
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Error al guardar paciente' });
      res.json({ mensaje: '✅ Paciente creado', id: result.insertId });
    }
  );
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

  db.query(
    sql,
    [
      paciente_id,
      presion_arterial,
      frecuencia_cardiaca,
      frecuencia_respiratoria,
      spo2 || null,
      temperatura,
      observaciones || null,
      usuario_id
    ],
    err => {
      if (err) return res.status(500).json({ error: 'Error al guardar signos' });
      res.json({ mensaje: '✅ Signos vitales registrados' });
    }
  );
});

// =======================
// LISTAR PACIENTES
// =======================
app.get('/pacientes', verificarToken, soloRoles('paramedico', 'profesor', 'coordinador'), (req, res) => {

  const sql = `
    SELECT 
      id,
      nombre,
      apellido,
      CONCAT(apellido, ' ', nombre) AS apellido_nombre,
      edad,
      sexo
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

    db.query(`
      SELECT COUNT(*) AS total
      FROM registros_signos
      WHERE DATE(fecha_hora) = CURDATE()
    `, (err, result2) => {
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
    DATE(r.fecha_hora) AS fecha,
    TIME(r.fecha_hora) AS hora_control,
    r.presion_arterial,
    r.frecuencia_respiratoria,
    r.frecuencia_cardiaca,
    r.spo2,
    r.temperatura,
    r.observaciones,
    COALESCE(u.nombre, 'No registrado') AS registrado_por,
    COALESCE(u.rol, '') AS rol_usuario
  FROM registros_signos r
  JOIN pacientes p ON r.paciente_id = p.id
  LEFT JOIN usuarios u ON r.usuario_id = u.id
  ORDER BY r.fecha_hora DESC
`;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: 'Error al obtener registros' });
    res.json(results);
  });
});


// =======================
// ENDPOINT /USUARIOS
// =======================
app.get('/usuarios', verificarToken, soloRoles('profesor'), (req, res) => {
  const sql = `
    SELECT id, nombre, email, rol
    FROM usuarios
    WHERE rol IN ('coordinador','paramedico')
    ORDER BY nombre ASC
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
// LIMPIAR PACIENTES (PROFESOR)
// =======================

app.delete('/limpiar-pacientes', verificarToken, soloRoles('profesor'), (req, res) => {

  const sql1 = `DELETE FROM registros_signos`;
  const sql2 = `DELETE FROM pacientes`;

  db.query(sql1, err => {

    if (err) {
      return res.status(500).json({ error: 'Error al borrar registros' });
    }

    db.query(sql2, err2 => {

      if (err2) {
        return res.status(500).json({ error: 'Error al borrar pacientes' });
      }

      res.json({ mensaje: '🧹 Todos los pacientes y registros fueron eliminados' });

    });

  });

});

// =======================
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});