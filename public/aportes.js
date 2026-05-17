const API = "http://localhost:3000";

// =======================
// CARGAR USUARIOS
// =======================
async function cargarUsuarios() {
  try {
    const token = localStorage.getItem("token");

    const res = await fetch(`${API}/usuarios`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    const usuarios = await res.json();

    const select = document.getElementById("usuario");
    select.innerHTML = '<option value="">Seleccione usuario</option>';

    usuarios.forEach(u => {
      const option = document.createElement("option");
      option.value = u.id;
      option.textContent = u.apellido_nombre;
      select.appendChild(option);
    });

  } catch (err) {
    console.error("Error cargando usuarios:", err);
  }
}


// =======================
// CARGAR APORTES
// =======================
const token = localStorage.getItem("token");
async function cargarAportes() {
  try {
    const res = await fetch(`${API}/aportes`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    const data = await res.json();

    const tabla = document.getElementById("tablaAportes");
    tabla.innerHTML = "";

    data.forEach(a => {
      const fila = `
        <tr>
          <td>${a.nombre || "—"}</td>
          <td>$${a.monto}</td>
          <td>${a.tipo_pago}</td>
          <td>
            ${
              a.comprobante 
              ? `
                <a href="${API}/uploads/${encodeURIComponent(a.comprobante)}" target="_blank">👁 Ver</a>
                |
                <a href="${API}/uploads/${encodeURIComponent(a.comprobante)}" download>⬇ Descargar</a>
              `
              : '—'
            }
          </td>
          <td>${new Date(a.fecha).toLocaleDateString()}</td>
        </tr>
      `;
      tabla.innerHTML += fila;
    });

    // 👉 GENERAMOS CALENDARIO
    generarCalendario(data);
    generarCalendarioUsuarios(data);

  } catch (err) {
    console.error("Error cargando aportes:", err);
  }
}


// =======================
// CALENDARIO
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

        div.style.padding = '10px';
        div.style.margin = '5px';
        div.style.borderRadius = '8px';
        div.style.color = 'white';
        div.style.cursor = 'pointer';
        div.style.display = 'inline-block';
        div.style.background = tieneAporte ? '#4CAF50' : '#f44336';

        div.innerHTML = `${mesNombre} ${tieneAporte ? '✅' : '❌'}`;

        if (tieneAporte) {
            div.onclick = () => {
                mostrarDetalleMes(mesNombre, aportesPorMes[index]);
            };
        }

        calendarioDiv.appendChild(div);
    });
}



// =======================
// DETALLE MES
// =======================
function mostrarDetalleMes(mes, aportes) {
    let detalle = `Aportes de ${mes}:\n\n`;

    aportes.forEach(a => {
        detalle += `${a.nombre} - $${a.monto}\n`;
    });

    alert(detalle);
}


// =======================
// GUARDAR APORTE
// =======================
window.onload = () => {
  cargarUsuarios();
  cargarAportes();

  const form = document.getElementById("formAporte");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData();

    formData.append("usuario_id", document.getElementById("usuario").value);
    formData.append("monto", document.getElementById("monto").value);
    formData.append("tipo_pago", document.getElementById("tipo_pago").value);

    const file = document.getElementById("comprobante").files[0];
    if (file) {
      formData.append("comprobante", file);
    }

    try {
      const token = localStorage.getItem("token");

await fetch(`${API}/aportes`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`
  },
  body: formData
});

      alert("✅ Aporte guardado");

      form.reset();
      cargarAportes();

    } catch (err) {
      console.error("Error guardando aporte:", err);
    }
  });
};




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
// CALENDARIO POR USUARIO
// =======================
function generarCalendarioUsuarios(aportes) {
  const contenedor = document.getElementById("calendarioUsuarios");
  contenedor.innerHTML = "";

  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const usuarios = {};

  aportes.forEach(a => {
    if (!usuarios[a.nombre]) {
      usuarios[a.nombre] = new Array(12).fill(false);
    }

    const mes = new Date(a.fecha).getMonth();
    usuarios[a.nombre][mes] = true;
  });

  let html = `<table class="styled-table"><thead><tr><th>Usuario</th>`;

  meses.forEach(m => {
    html += `<th>${m}</th>`;
  });

  html += `</tr></thead><tbody>`;

  for (let usuario in usuarios) {
    html += `<tr><td>${usuario}</td>`;

    usuarios[usuario].forEach(pago => {
      html += `<td>${pago ? "✅" : "❌"}</td>`;
    });

    html += `</tr>`;
  }

  html += `</tbody></table>`;

  contenedor.innerHTML = html;
}

