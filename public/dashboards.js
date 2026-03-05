// public/js/dashboards.js

const API = "http://localhost:3000";
const token = localStorage.getItem("token");
const rol = localStorage.getItem("rol");

if (!token) {
  window.location.href = "login.html";
}

let registrosTotales = [];
let registrosFiltrados = [];
let usuariosTotales = [];

// =======================
// FETCH CON AUTORIZACIÓN
// =======================
async function authFetch(url, options = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.clear();
      window.location.href = "login.html";
      return;
    }

    return await res.json();
  } catch (err) {
    console.error("Error en authFetch:", err);
    throw err;
  }
}

// =======================
// CARGAR RESUMEN
// =======================
async function cargarResumen() {
  try {
    const data = await authFetch(`${API}/dashboard/resumen`);
    if (!data) return;

    document.getElementById("total-pacientes")?.innerText = data.total_pacientes || 0;
    document.getElementById("controles-hoy")?.innerText = data.controles_hoy || 0;
    document.getElementById("ultimo-registro")?.innerText = data.ultimo_registro?.apellido_nombre || "-";
  } catch (err) {
    console.error("Error cargarResumen:", err);
  }
}

// =======================
// CARGAR ALERTAS
// =======================
async function cargarAlertas() {
  try {
    const data = await authFetch(`${API}/dashboard/alertas`);
    if (!data) return;

    const tabla = document.getElementById("tabla-alertas");
    if (!tabla) return;

    tabla.innerHTML = `
      <tr>
        <th>Paciente</th><th>FC</th><th>FR</th><th>SpO₂</th><th>Temp</th><th>Fecha</th>
      </tr>
    `;

    data.forEach(reg => {
      const fila = document.createElement("tr");
      fila.innerHTML = `
        <td>${reg.apellido_nombre}</td>
        <td>${reg.frecuencia_cardiaca || ""}</td>
        <td>${reg.frecuencia_respiratoria || ""}</td>
        <td>${reg.spo2 || ""}</td>
        <td>${reg.temperatura || ""}</td>
        <td>${new Date(reg.fecha_hora).toLocaleString()}</td>
      `;
      tabla.appendChild(fila);
    });
  } catch (err) {
    console.error("Error cargarAlertas:", err);
  }
}

// =======================
// CARGAR REGISTROS
// =======================
async function cargarRegistros() {
  try {
    registrosTotales = await authFetch(`${API}/registros_signos`);
    registrosFiltrados = [...registrosTotales];

    cargarPacientesSelect();
    cargarUsuariosSelect();
    renderTabla();
  } catch (err) {
    console.error("Error cargarRegistros:", err);
  }
}

// =======================
// FILTROS SELECT
// =======================
function cargarPacientesSelect() {
  const select = document.getElementById("paciente_select");
  if (!select) return;

  select.innerHTML = '<option value="">Todos</option>';
  const pacientes = [...new Set(registrosTotales.map(r => r.paciente))];
  pacientes.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    select.appendChild(opt);
  });
}

function cargarUsuariosSelect() {
  const select = document.getElementById("usuario_select");
  if (!select) return;

  select.innerHTML = '<option value="">Todos</option>';
  const usuarios = [...new Set(registrosTotales.map(r => r.registrado_por))];
  usuarios.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u;
    opt.textContent = u;
    select.appendChild(opt);
  });
}

// =======================
// APLICAR FILTROS
// =======================
function aplicarFiltros() {
  const paciente = document.getElementById("paciente_select")?.value;
  const usuario = document.getElementById("usuario_select")?.value;
  const fecha = document.getElementById("filtro_fecha")?.value;

  registrosFiltrados = registrosTotales.filter(r => {
    let ok = true;
    if (paciente) ok = ok && r.paciente === paciente;
    if (usuario) ok = ok && r.registrado_por === usuario;
    if (fecha) ok = ok && r.fecha === fecha;
    return ok;
  });

  renderTabla();
}

// =======================
// RENDER TABLA REGISTROS
// =======================
function renderTabla() {
  const tbody = document.querySelector("#tabla-registros tbody");
  if (!tbody) return;

  tbody.innerHTML = "";
  registrosFiltrados.forEach(r => {
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${r.paciente}</td>
      <td>${r.fecha} ${r.hora_control}</td>
      <td>${r.presion_arterial || ""}</td>
      <td>${r.frecuencia_respiratoria || ""}</td>
      <td>${r.frecuencia_cardiaca || ""}</td>
      <td>${r.spo2 || ""}</td>
      <td>${r.temperatura || ""}</td>
      <td>${r.observaciones || ""}</td>
      <td>${r.registrado_por || ""}</td>
    `;
    tbody.appendChild(fila);
  });
}

// =======================
// EXPORTACIONES
// =======================
function exportExcel() {
  if (!registrosFiltrados.length) return alert("No hay datos para exportar");

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(registrosFiltrados);
  XLSX.utils.book_append_sheet(wb, ws, "Registros");
  XLSX.writeFile(wb, "registros_paramedico.xlsx");
}

function exportPDF() {
  if (!registrosFiltrados.length) return alert("No hay datos para exportar");

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const cols = ["Paciente", "Fecha/Hora", "PA", "FR", "FC", "SpO₂", "Temp", "Obs", "Registrado por"];
  const rows = registrosFiltrados.map(r => [
    r.paciente,
    `${r.fecha} ${r.hora_control}`,
    r.presion_arterial,
    r.frecuencia_respiratoria,
    r.frecuencia_cardiaca,
    r.spo2,
    r.temperatura,
    r.observaciones,
    r.registrado_por
  ]);

  doc.autoTable({ head: [cols], body: rows });
  doc.save("registros_paramedico.pdf");
}

// =======================
// GESTIÓN DE USUARIOS (SOLO PROFESOR)
// =======================
async function cargarUsuarios() {
  if (rol !== "profesor") return;

  try {
    usuariosTotales = await authFetch(`${API}/usuarios`);
    const tabla = document.getElementById("tabla-usuarios");
    if (!tabla) return;

    tabla.innerHTML = "<tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Acción</th></tr>";

    usuariosTotales
      .filter(u => u.rol === "coordinador" || u.rol === "paramedico")
      .forEach(u => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${u.nombre}</td>
          <td>${u.email}</td>
          <td>${u.rol}</td>
          <td>
            <button onclick="eliminarUsuario(${u.id})" style="background:#ff5252;color:white;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;">
              Eliminar
            </button>
          </td>
        `;
        tabla.appendChild(tr);
      });
  } catch (err) {
    console.error("Error cargarUsuarios:", err);
    alert("No se pudieron cargar los usuarios");
  }
}

async function eliminarUsuario(id) {
  if (rol !== "profesor") return alert("Solo un profesor puede eliminar usuarios");

  if (!confirm("¿Seguro que desea eliminar este usuario?")) return;

  try {
    await authFetch(`${API}/usuarios/${id}`, { method: "DELETE" });
    alert("Usuario eliminado");
    cargarUsuarios();
  } catch (err) {
    console.error("Error eliminarUsuario:", err);
    alert("No se pudo eliminar el usuario");
  }
}

function limpiarPacientes() {

  if (!confirm("⚠ Esto eliminará TODOS los pacientes y registros. ¿Continuar?")) {
    return;
  }

  fetch("http://localhost:3000/limpiar-pacientes", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`
    }
  })
  .then(res => res.json())
  .then(data => {
    alert(data.mensaje);
    location.reload(); // recargar tabla
  })
  .catch(err => {
    alert("Error al limpiar pacientes");
    console.error(err);
  });

}

function toggleUsuarios() {
  const container = document.getElementById("tabla-usuarios-container");
  if (!container) return;

  container.style.display = container.style.display === "none" ? "block" : "none";
  if (container.style.display === "block") cargarUsuarios();
}

// =======================
// CERRAR SESIÓN
// =======================
function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}

// =======================
// INICIALIZAR DASHBOARD
// =======================
window.onload = () => {
  cargarResumen();
  cargarAlertas();
  cargarRegistros();

  // Actualizar resumen y alertas cada 10 segundos
  setInterval(() => {
    cargarResumen();
    cargarAlertas();
  }, 10000);
};