
const $ = selector => document.querySelector(selector);

const toast = message => {
  const t = $("#toast");
  t.textContent = message;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 3000);
};

$("#menuToggle").addEventListener("click", () => {
  $("#mainNav").classList.toggle("open");
});

document.querySelectorAll("#mainNav a").forEach(link => {
  link.addEventListener("click", () => $("#mainNav").classList.remove("open"));
});

document.querySelectorAll(".choose").forEach(button => {
  button.addEventListener("click", () => {
    $("#packageSelect").value = button.dataset.package;
    $("#asesoria").scrollIntoView({ behavior: "smooth" });
    toast("Seleccionaste el paquete " + button.dataset.package + ". Completa el formulario para preparar tu solicitud.");
  });
});

const money = amount =>
  new Intl.NumberFormat("es-SV", {
    style: "currency",
    currency: "USD"
  }).format(Number(amount) || 0);

const esc = value =>
  String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));

// INVENTARIO
const INVENTORY_KEY = "brandspark_demo_inventory_v1";
let products = [];

try {
  products = JSON.parse(localStorage.getItem(INVENTORY_KEY) || "[]");
  if (!Array.isArray(products)) products = [];
} catch {
  products = [];
}

function saveInventory() {
  try {
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(products));
  } catch {
    toast("No se pudieron guardar los datos en este navegador.");
  }
}

function renderInventory() {
  const body = $("#inventoryRows");

  body.innerHTML = products.length
    ? products.map((product, index) => `
      <tr>
        <td>${esc(product.name)}</td>
        <td>${esc(product.category || "Sin categoría")}</td>
        <td>${product.quantity}</td>
        <td>${money(product.price)}</td>
        <td>${money(product.quantity * product.price)}</td>
        <td><button data-del="${index}" aria-label="Eliminar producto">✕</button></td>
      </tr>
    `).join("")
    : '<tr><td colspan="6" class="empty">Todavía no hay productos. Agrega uno para comenzar.</td></tr>';

  $("#productCount").textContent = products.length;
  $("#unitCount").textContent = products.reduce((sum, product) => sum + product.quantity, 0);
  $("#inventoryValue").textContent = money(
    products.reduce((sum, product) => sum + product.quantity * product.price, 0)
  );

  $("#previewProductCount").textContent = products.length;
  $("#previewUnitCount").textContent = products.reduce((sum, product) => sum + product.quantity, 0);
  $("#previewInventoryValue").textContent = money(
    products.reduce((sum, product) => sum + product.quantity * product.price, 0)
  );

  $("#inventoryPreviewList").innerHTML = products.length
    ? products.map(product => `
      <div class="file-item">
        <div>
          <b>${esc(product.name)}</b>
          <small>${esc(product.category || "Sin categoría")} · ${product.quantity} unidades</small>
        </div>
        <strong>${money(product.quantity * product.price)}</strong>
      </div>
    `).join("")
    : '<p class="empty">Agrega productos en Control de inventario para verlos aquí.</p>';
}

$("#inventoryForm").addEventListener("submit", event => {
  event.preventDefault();

  const form = new FormData(event.currentTarget);
  const name = String(form.get("productName")).trim();
  const quantity = Number(form.get("quantity"));
  const price = Number(form.get("price"));

  if (!name || quantity < 0 || price < 0 ||
      !Number.isFinite(quantity) || !Number.isFinite(price)) {
    toast("Revisa el nombre, la cantidad y el precio.");
    return;
  }

  products.push({
    name,
    quantity: Math.floor(quantity),
    price,
    category: String(form.get("category") || "").trim()
  });

  saveInventory();
  renderInventory();
  event.currentTarget.reset();
  toast("Producto agregado al inventario de demostración.");
});

$("#inventoryRows").addEventListener("click", event => {
  const button = event.target.closest("[data-del]");
  if (!button) return;

  products.splice(Number(button.dataset.del), 1);
  saveInventory();
  renderInventory();
  toast("Producto eliminado.");
});

$("#clearInventory").addEventListener("click", () => {
  if (!products.length) {
    toast("La lista ya está vacía.");
    return;
  }

  if (confirm("¿Eliminar todos los productos guardados en este navegador?")) {
    products = [];
    saveInventory();
    renderInventory();
    toast("Lista vaciada.");
  }
});

// CAMBIAR ENTRE LAS VISTAS PREVIAS
document.querySelectorAll(".preview-card").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".preview-card").forEach(card => {
      card.classList.remove("active");
    });

    button.classList.add("active");

    document.querySelectorAll(".tool-view").forEach(view => {
      view.hidden = view.id !== button.dataset.view;
    });
  });
});

// ARCHIVO DIGITAL: BASE DE DATOS DEL NAVEGADOR
const DB_NAME = "BrandSparkFiles";
const DB_VERSION = 1;
let fileDB = null;

function openFileDB() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Este navegador no admite el almacenamiento de archivos."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("files")) {
        db.createObjectStore("files", {
          keyPath: "id",
          autoIncrement: true
        });
      }
    };

    request.onsuccess = () => {
      fileDB = request.result;
      resolve(fileDB);
    };

    request.onerror = () => reject(request.error);
  });
}

function fileTransaction(mode, action) {
  return new Promise((resolve, reject) => {
    if (!fileDB) {
      reject(new Error("El almacenamiento de archivos aún no está disponible."));
      return;
    }

    const transaction = fileDB.transaction("files", mode);
    const request = action(transaction.objectStore("files"));

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function renderFiles() {
  const list = $("#fileList");

  try {
    const files = await fileTransaction("readonly", store => store.getAll());

    if (!files.length) {
      list.innerHTML = '<p class="empty">Todavía no hay archivos guardados.</p>';
      return;
    }

    list.innerHTML = files.map(file => `
      <div class="file-item">
        <div>
          <b>${esc(file.name)}</b>
          <small>${esc(file.company)} · ${esc(file.description || "Sin descripción")}</small>
          <small>${esc(file.fileName)} · ${money(file.size / 1024)} KB aprox.</small>
        </div>
        <div class="file-actions">
          <button type="button" data-open-file="${file.id}">Abrir</button>
          <button type="button" data-download-file="${file.id}">Descargar</button>
          <button type="button" data-delete-file="${file.id}">Eliminar</button>
        </div>
      </div>
    `).join("");
  } catch (error) {
    list.textContent = "No fue posible mostrar los archivos guardados.";
  }
}

$("#fileForm").addEventListener("submit", async event => {
  event.preventDefault();

  const form = new FormData(event.currentTarget);
  const selectedFile = form.get("document");

  if (!(selectedFile instanceof File) || !selectedFile.name) {
    toast("Selecciona un archivo primero.");
    return;
  }

  try {
    await fileTransaction("readwrite", store => store.add({
      company: String(form.get("company")).trim(),
      description: String(form.get("description") || "").trim(),
      name: selectedFile.name,
      fileName: selectedFile.name,
      type: selectedFile.type || "application/octet-stream",
      size: selectedFile.size,
      blob: selectedFile,
      savedAt: new Date().toISOString()
    }));

    event.currentTarget.reset();
    await renderFiles();
    toast("Archivo guardado en este navegador.");
  } catch (error) {
    toast("No se pudo guardar el archivo. Comprueba el espacio disponible.");
  }
});

$("#fileList").addEventListener("click", async event => {
  const openButton = event.target.closest("[data-open-file]");
  const downloadButton = event.target.closest("[data-download-file]");
  const deleteButton = event.target.closest("[data-delete-file]");

  const button = openButton || downloadButton || deleteButton;
  if (!button) return;

  const id = Number(
    button.dataset.openFile ||
    button.dataset.downloadFile ||
    button.dataset.deleteFile
  );

  try {
    if (deleteButton) {
      if (!confirm("¿Eliminar este archivo guardado?")) return;

      await fileTransaction("readwrite", store => store.delete(id));
      await renderFiles();
      toast("Archivo eliminado.");
      return;
    }

    const file = await fileTransaction("readonly", store => store.get(id));
    if (!file) {
      toast("No se encontró el archivo.");
      return;
    }

    const url = URL.createObjectURL(file.blob);

    if (downloadButton) {
      const link = document.createElement("a");
      link.href = url;
      link.download = file.fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else {
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  } catch (error) {
    toast("No fue posible completar esa acción.");
  }
});

// INGRESOS Y GASTOS
const FINANCE_KEY = "brandspark_demo_finance_v1";
let movements = [];

try {
  movements = JSON.parse(localStorage.getItem(FINANCE_KEY) || "[]");
  if (!Array.isArray(movements)) movements = [];
} catch {
  movements = [];
}

function saveFinance() {
  try {
    localStorage.setItem(FINANCE_KEY, JSON.stringify(movements));
  } catch {
    toast("No se pudieron guardar los movimientos.");
  }
}

function renderFinance() {
  const income = movements
    .filter(item => item.type === "ingreso")
    .reduce((sum, item) => sum + item.amount, 0);

  const expenses = movements
    .filter(item => item.type === "gasto")
    .reduce((sum, item) => sum + item.amount, 0);

  $("#incomeTotal").textContent = money(income);
  $("#expenseTotal").textContent = money(expenses);
  $("#balanceTotal").textContent = money(income - expenses);

  $("#financeRows").innerHTML = movements.length
    ? movements.map((item, index) => `
      <tr>
        <td>${esc(item.date)}</td>
        <td>${item.type === "ingreso" ? "Ingreso" : "Gasto"}</td>
        <td>${esc(item.concept)}</td>
        <td>${money(item.amount)}</td>
        <td><button type="button" data-delete-movement="${index}">✕</button></td>
      </tr>
    `).join("")
    : '<tr><td colspan="5" class="empty">Todavía no hay movimientos.</td></tr>';
}

$("#financeForm").addEventListener("submit", event => {
  event.preventDefault();

  const form = new FormData(event.currentTarget);
  const amount = Number(form.get("amount"));

  if (!Number.isFinite(amount) || amount <= 0) {
    toast("Ingresa un monto válido.");
    return;
  }

  movements.push({
    type: String(form.get("type")),
    date: String(form.get("date")),
    concept: String(form.get("concept")).trim(),
    amount
  });

  saveFinance();
  renderFinance();
  event.currentTarget.reset();
  $("#financeForm [name='date']").value = new Date().toISOString().slice(0, 10);
  toast("Movimiento guardado.");
});

$("#financeRows").addEventListener("click", event => {
  const button = event.target.closest("[data-delete-movement]");
  if (!button) return;

  movements.splice(Number(button.dataset.deleteMovement), 1);
  saveFinance();
  renderFinance();
  toast("Movimiento eliminado.");
});

$("#clearFinance").addEventListener("click", () => {
  if (!movements.length) {
    toast("No hay movimientos que eliminar.");
    return;
  }

  if (confirm("¿Eliminar todos los ingresos y gastos guardados en este navegador?")) {
    movements = [];
    saveFinance();
    renderFinance();
    toast("Registro financiero vaciado.");
  }
});

// FORMULARIOS DE CONTACTO Y ASESORÍA
function setupForm(formId, feedbackId, type) {
  $(formId).addEventListener("submit", event => {
    event.preventDefault();

    const data = Object.fromEntries(new FormData(event.currentTarget));

    const summary = type === "advice"
      ? `SOLICITUD DE ASESORÍA BRANDSPARK
Nombre: ${data.name}
Emprendimiento: ${data.business}
Correo: ${data.email}
Paquete: ${data.package}
Área: ${data.area}
Mensaje: ${data.message}`
      : `MENSAJE PARA BRANDSPARK
Nombre: ${data.contactName}
Correo: ${data.contactEmail}
Mensaje: ${data.contactMessage}`;

    const output = $(feedbackId);
    output.replaceChildren();

    const message = document.createElement("p");
    message.textContent = "Tu información está preparada. Este prototipo no la envía automáticamente; puedes copiar el resumen o abrir tu correo para enviarlo al equipo.";

    const details = document.createElement("details");
    const summaryElement = document.createElement("summary");
    const pre = document.createElement("pre");

    summaryElement.textContent = "Ver resumen";
    pre.style.whiteSpace = "pre-wrap";
    pre.textContent = summary;

    details.append(summaryElement, pre);

    const copyButton = document.createElement("button");
    copyButton.className = "btn outline";
    copyButton.type = "button";
    copyButton.textContent = "Copiar resumen";

    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(summary);
        toast("Resumen copiado.");
      } catch {
        toast("Abre el resumen, selecciónalo y cópialo manualmente.");
      }
    });

    const emailButton = document.createElement("a");
    emailButton.className = "btn primary";
    emailButton.textContent = "Abrir correo para enviarlo";
    emailButton.href =
      "mailto:brandsparksv@gmail.com?subject=" +
      encodeURIComponent(type === "advice" ? "Solicitud de asesoría BrandSpark" : "Mensaje para BrandSpark") +
      "&body=" + encodeURIComponent(summary);

    output.append(message, copyButton, emailButton, details);
    toast("Solicitud preparada correctamente.");
  });
}

setupForm("#adviceForm", "#adviceFeedback", "advice");
setupForm("#contactForm", "#contactFeedback", "contact");

// INICIALIZACIÓN
$("#year").textContent = new Date().getFullYear();
$("#financeForm [name='date']").value = new Date().toISOString().slice(0, 10);

openFileDB()
  .then(renderFiles)
  .catch(() => {
    $("#fileList").textContent = "El almacenamiento de archivos no está disponible en este navegador.";
  });

renderInventory();
renderFinance();
