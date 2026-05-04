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
async function cargarAportes() {
  try {
    const res = await fetch(`${API}/aportes`);
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
            ${a.comprobante 
              ? `<a href="${API}/uploads/${a.comprobante}" target="_blank">Ver</a>`
              : '—'}
          </td>
          <td>${new Date(a.fecha).toLocaleDateString()}</td>
        </tr>
      `;
      tabla.innerHTML += fila;
    });

  } catch (err) {
    console.error("Error cargando aportes:", err);
  }
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
      await fetch(`${API}/aportes`, {
        method: "POST",
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

