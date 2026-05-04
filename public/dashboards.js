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
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${token}` 
      }
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
        <td>${formatearFechaHora(reg.fecha_hora, reg.hora_control)}</td>
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
    const data = await authFetch(`${API}/registros_signos`);
    registrosTotales = Array.isArray(data) ? data : [];
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
// FUNCIONES AUXILIARES
// =======================
function formatearFechaHora(fechaISO, horaControl) {
  if (!fechaISO) return "—";

  try {
    const fechaObj = new Date(fechaISO);
    const fechaFormateada = fechaObj.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    let horaFormateada = '';
    if (horaControl) {
      const [h, m] = horaControl.split(':');
      const hh = h.padStart(2, '0');
      const mm = m ? m.padStart(2, '0') : '00';
      horaFormateada = `${hh}:${mm}`;
    }

    return horaFormateada ? `${fechaFormateada} ${horaFormateada}` : fechaFormateada;

  } catch (err) {
    console.error("Error formateando fecha:", fechaISO, err);
    return "—";
  }
}

// =======================
// RENDER TABLA REGISTROS
// =======================
function renderTabla() {
  const tbody = document.querySelector("#tabla-registros tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  registrosFiltrados.forEach(r => {
    const paciente = r.paciente || "—";
    const sexo = r.sexo || "—";
    const fechaHora = formatearFechaHora(r.fecha, r.hora_control);
    const presion = r.presion_arterial || "—";
    const fr = r.frecuencia_respiratoria || "—";
    const fc = r.frecuencia_cardiaca || "—";
    const spo2 = r.spo2 || "—";
    const temp = r.temperatura || "—";
    const obs = r.observaciones || "—";
    const registradoPor = r.registrado_por || "—";
    const rolUsuario = r.rol_usuario || "—";

    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${paciente}</td>
      <td>${sexo}</td>
      <td>${fechaHora}</td>
      <td>${presion}</td>
      <td>${fr}</td>
      <td>${fc}</td>
      <td>${spo2}</td>
      <td>${temp}</td>
      <td>${obs}</td>
      <td>${registradoPor}</td>
      <td>${rolUsuario}</td>
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
  const exportData = registrosFiltrados.map(r => ({
    Paciente: r.paciente,
    Sexo: r.sexo || "—",
    "Fecha / Hora": formatearFechaHora(r.fecha, r.hora_control),
    PA: r.presion_arterial || "",
    FR: r.frecuencia_respiratoria || "",
    FC: r.frecuencia_cardiaca || "",
    "SpO₂": r.spo2 || "",
    Temp: r.temperatura || "",
    Observaciones: r.observaciones || "",
    "Registrado por": r.registrado_por || ""
  }));
  const ws = XLSX.utils.json_to_sheet(exportData);
  XLSX.utils.book_append_sheet(wb, ws, "Registros");
  XLSX.writeFile(wb, "registros_paramedico.xlsx");
}

function exportPDF() {
  if (!registrosFiltrados.length) return alert("No hay datos para exportar");

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const cols = ["Paciente", "Sexo", "Fecha / Hora", "PA", "FR", "FC", "SpO₂", "Temp", "Obs", "Registrado por"];
  const rows = registrosFiltrados.map(r => [
    r.paciente,
    r.sexo || "—",
    formatearFechaHora(r.fecha, r.hora_control),
    r.presion_arterial || "",
    r.frecuencia_respiratoria || "",
    r.frecuencia_cardiaca || "",
    r.spo2 || "",
    r.temperatura || "",
    r.observaciones || "",
    r.registrado_por || ""
  ]);

  doc.autoTable({ head: [cols], body: rows });
  doc.save("registros_paramedico.pdf");
}

// =======================
// GESTIÓN DE USUARIOS
// =======================
async function cargarUsuarios() {
  if (rol !== "profesor") return;

  try {
    usuariosTotales = await authFetch(`${API}/usuarios`);
    const tabla = document.getElementById("tabla-usuarios");
    if (!tabla) return;

    tabla.innerHTML = "<tr><th>Apellido, Nombre</th><th>Email</th><th>Rol</th><th>Acción</th></tr>";

    usuariosTotales
      .filter(u => u.rol === "coordinador" || u.rol === "paramedico")
      .forEach(u => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${u.apellido_nombre}</td>
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
  if (!confirm("⚠ Esto eliminará TODOS los pacientes y registros. ¿Continuar?")) return;

  fetch(`${API}/limpiar-pacientes`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(data => {
      alert(data.mensaje);
      location.reload();
    })
    .catch(err => {
      console.error("Error al limpiar pacientes:", err);
      alert("Error al limpiar pacientes");
    });
}

function toggleUsuarios() {
  const container = document.getElementById("tabla-usuarios-container");
  if (!container) return;

  container.style.display = container.style.display === "none" ? "block" : "none";
  if (container.style.display === "block") cargarUsuarios();
}

function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}

function irADashboardParamedico() {
  window.location.href = "dashboard_paramedico.html";
}

// =======================
// INICIALIZAR DASHBOARD
// =======================
window.onload = () => {
  cargarResumen();
  cargarAlertas();
  cargarRegistros();

  setInterval(() => {
    cargarResumen();
    cargarAlertas();
  }, 10000);
};