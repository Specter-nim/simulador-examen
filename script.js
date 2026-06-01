// ========================================
// CONFIGURACIÓN Y VARIABLES GLOBALES
// ========================================
const CSV_FILE = "banco_preguntas_examen.csv";
const STORAGE_KEY = "senati_historial_preguntas_usadas_v2";
const LETRAS = ["A", "B", "C", "D", "E"];

let bancoPreguntas = [];
let examenActual = [];
let respuestasUsuario = {};
let resultadosActuales = [];

// Selector corto de elementos
const $ = (id) => document.getElementById(id);

// Objetos con referencias a elementos del DOM
const elementos = {
  inicio: $("inicio"),
  examen: $("examen"),
  resultado: $("resultado"),

  csvStatus: $("csvStatus"),
  btnIniciar: $("btnIniciar"),
  btnTerminar: $("btnTerminar"),
  btnCancelar: $("btnCancelar"),
  btnNuevoExamen: $("btnNuevoExamen"),
  btnReiniciarHistorial: $("btnReiniciarHistorial"),
  btnVerIncorrectas: $("btnVerIncorrectas"),
  btnVerTodo: $("btnVerTodo"),

  cantidadPreguntas: $("cantidadPreguntas"),
  modoSeleccion: $("modoSeleccion"),

  totalPreguntas: $("totalPreguntas"),
  preguntasUsadas: $("preguntasUsadas"),
  preguntasDisponibles: $("preguntasDisponibles"),

  contenedorPreguntas: $("contenedorPreguntas"),
  contadorRespondidas: $("contadorRespondidas"),
  barraProgreso: $("barraProgreso"),

  puntajeFinal: $("puntajeFinal"),
  porcentajeFinal: $("porcentajeFinal"),
  totalCorrectas: $("totalCorrectas"),
  totalIncorrectas: $("totalIncorrectas"),
  totalBlanco: $("totalBlanco"),
  revision: $("revision")
};

// ========================================
// INICIALIZACIÓN
// ========================================

document.addEventListener("DOMContentLoaded", iniciarApp);

/**
 * Inicializa la aplicación cargando el CSV o JSON y configurando eventos
 */
async function iniciarApp() {
  try {
    // Intentar cargar JSON primero (tiene 3000+ preguntas y es más confiable)
    let respuestaJSON = await fetch("banco_preguntas_senati_3000.json");
    
    if (respuestaJSON.ok) {
      const datosJSON = await respuestaJSON.json();
      bancoPreguntas = Array.isArray(datosJSON) 
        ? datosJSON.map(normalizarPregunta).filter(validarPregunta)
        : datosJSON.preguntas?.map(normalizarPregunta).filter(validarPregunta) || [];

      if (bancoPreguntas.length > 0) {
        elementos.csvStatus.textContent = `✓ Banco cargado desde JSON: ${bancoPreguntas.length} preguntas disponibles.`;
        elementos.csvStatus.classList.remove("error");
        elementos.btnIniciar.disabled = false;
        actualizarEstadisticas();
        configurarEventos();
        return;
      }
    }
  } catch (errorJSON) {
    console.warn("JSON no disponible:", errorJSON.message);
  }

  // Si falla JSON, intentar CSV
  try {
    const respuestaCSV = await fetch(CSV_FILE);
    
    if (respuestaCSV.ok) {
      const textoCSV = await respuestaCSV.text();
      bancoPreguntas = parseCSV(textoCSV)
        .map(normalizarPregunta)
        .filter(validarPregunta);

      if (bancoPreguntas.length > 0) {
        elementos.csvStatus.textContent = `✓ Banco cargado desde CSV: ${bancoPreguntas.length} preguntas disponibles.`;
        elementos.csvStatus.classList.remove("error");
        elementos.btnIniciar.disabled = false;
        actualizarEstadisticas();
        configurarEventos();
        return;
      }
    }
  } catch (errorCSV) {
    console.warn("CSV no disponible:", errorCSV.message);
  }

  // Si fallan ambos
  elementos.csvStatus.textContent =
    "⚠ No se pudieron cargar los archivos (JSON ni CSV disponibles). Verifica que ambos estén subidos al mismo directorio en Hostinger.";
  elementos.csvStatus.classList.add("error");
  configurarEventos();
}

/**
 * Configura todos los event listeners
 */
function configurarEventos() {
  elementos.btnIniciar.addEventListener("click", iniciarExamen);
  elementos.btnTerminar.addEventListener("click", terminarExamen);
  elementos.btnCancelar.addEventListener("click", cancelarExamen);
  elementos.btnNuevoExamen.addEventListener("click", volverInicio);
  elementos.btnReiniciarHistorial.addEventListener("click", reiniciarHistorial);
  elementos.btnVerIncorrectas.addEventListener("click", () => mostrarRevision("incorrectas"));
  elementos.btnVerTodo.addEventListener("click", () => mostrarRevision("todo"));
}

// ========================================
// PARSEO Y VALIDACIÓN DE CSV
// ========================================

/**
 * Parsea un archivo CSV respetando comillas y manejando correctamente saltos de línea
 * @param {string} texto - Contenido del archivo CSV
 * @returns {array} Array de objetos con los datos del CSV
 */
function parseCSV(texto) {
  // Eliminar BOM si existe
  texto = texto.replace(/^\uFEFF/, "");

  const filas = [];
  let fila = [];
  let celda = "";
  let dentroComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const char = texto[i];
    const siguiente = texto[i + 1];

    // Manejar comillas dobles dentro de comillas (escape)
    if (char === '"' && dentroComillas && siguiente === '"') {
      celda += '"';
      i++;
    } 
    // Alternar estado de comillas
    else if (char === '"') {
      dentroComillas = !dentroComillas;
    } 
    // Separador de celdas (coma) si no estamos dentro de comillas
    else if (char === "," && !dentroComillas) {
      fila.push(celda);
      celda = "";
    } 
    // Separador de filas (salto de línea) si no estamos dentro de comillas
    else if ((char === "\n" || char === "\r") && !dentroComillas) {
      if (char === "\r" && siguiente === "\n") i++;
      fila.push(celda);
      if (fila.some(valor => valor.trim() !== "")) filas.push(fila);
      fila = [];
      celda = "";
    } 
    // Acumular carácter
    else {
      celda += char;
    }
  }

  // Procesar última fila si existe
  if (celda.length > 0 || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }

  // Procesar encabezados
  const encabezados = filas.shift().map(h => h.trim());

  // Convertir filas en objetos
  return filas.map(fila => {
    const objeto = {};
    encabezados.forEach((encabezado, index) => {
      objeto[encabezado] = fila[index] ? fila[index].trim() : "";
    });
    return objeto;
  });
}

/**
 * Normaliza una pregunta del CSV a un formato estándar
 * @param {object} p - Objeto pregunta del CSV
 * @returns {object} Pregunta normalizada
 */
function normalizarPregunta(p) {
  return {
    id: Number(p.id) || crearIdTemporal(p),
    modulo: p.modulo || "General",
    semana: p.semana || "",
    tema: p.tema || "General",
    subtema: p.subtema || "",
    nivel: p.nivel || "",
    tipo_pregunta: p.tipo_pregunta || "",
    pregunta: p.pregunta || "",
    opcion_a: p.opcion_a || "",
    opcion_b: p.opcion_b || "",
    opcion_c: p.opcion_c || "",
    opcion_d: p.opcion_d || "",
    opcion_e: p.opcion_e || "",
    respuesta_correcta: (p.respuesta_correcta || "").toUpperCase().trim(),
    respuesta_texto: p.respuesta_texto || "",
    explicacion: p.explicacion || "",
    fuente_base: p.fuente_base || "",
    tags: p.tags || ""
  };
}

/**
 * Crea un ID temporal para preguntas sin ID
 * @param {object} p - Pregunta
 * @returns {number} ID generado por hash
 */
function crearIdTemporal(p) {
  const texto = `${p.modulo}-${p.tema}-${p.pregunta}`;
  let hash = 0;

  for (let i = 0; i < texto.length; i++) {
    hash = ((hash << 5) - hash) + texto.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash);
}

/**
 * Valida que una pregunta tenga todos los campos requeridos
 * @param {object} p - Pregunta a validar
 * @returns {boolean} true si es válida
 */
function validarPregunta(p) {
  // Validación simplificada: solo requiere pregunta y al menos las opciones básicas
  const tieneOpcionesMinimas =
    (p.opcion_a || p.opcion_b || p.opcion_c || p.opcion_d || p.opcion_e);
  
  const tieneRespuestaValida =
    p.respuesta_correcta && LETRAS.includes(p.respuesta_correcta);
  
  return p.pregunta && tieneOpcionesMinimas && tieneRespuestaValida;
}

// ========================================
// LÓGICA DE EXAMEN
// ========================================

/**
 * Inicia un nuevo examen seleccionando preguntas
 */
function iniciarExamen() {
  const cantidad = Number(elementos.cantidadPreguntas.value);
  const modo = elementos.modoSeleccion.value;

  examenActual = seleccionarPreguntas(cantidad, modo);
  respuestasUsuario = {};

  if (examenActual.length === 0) {
    alert("No hay preguntas disponibles. Reinicia el historial e intenta nuevamente.");
    return;
  }

  renderizarPreguntas();

  elementos.inicio.classList.add("hidden");
  elementos.resultado.classList.add("hidden");
  elementos.examen.classList.remove("hidden");

  actualizarProgreso();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Selecciona preguntas para el examen evitando repeticiones
 * @param {number} cantidad - Cantidad de preguntas a seleccionar
 * @param {string} modo - Modo de selección: "balanceado" o "aleatorio"
 * @returns {array} Array de preguntas seleccionadas
 */
function seleccionarPreguntas(cantidad, modo) {
  const usadas = new Set(obtenerHistorial());
  let disponibles = bancoPreguntas.filter(p => !usadas.has(p.id));

  // Si no hay suficientes preguntas disponibles, limpiar historial parcialmente
  if (disponibles.length < cantidad) {
    const idsActuales = examenActual.map(p => p.id);
    guardarHistorial(idsActuales);
    disponibles = bancoPreguntas.filter(p => !idsActuales.includes(p.id));
  }

  // Si aún no hay suficientes, usar todas disponibles
  if (disponibles.length < cantidad) {
    disponibles = mezclar(bancoPreguntas).slice(0, cantidad);
  }

  // Seleccionar según el modo
  if (modo === "balanceado") {
    return seleccionarBalanceado(disponibles, cantidad);
  }

  return mezclar(disponibles).slice(0, cantidad);
}

/**
 * Selecciona preguntas de forma balanceada por módulo y tema
 * @param {array} preguntas - Pool de preguntas disponibles
 * @param {number} cantidad - Cantidad a seleccionar
 * @returns {array} Preguntas seleccionadas
 */
function seleccionarBalanceado(preguntas, cantidad) {
  const seleccionadas = [];
  const porModulo = agruparPor(preguntas, p => p.modulo);
  const modulos = mezclar(Object.keys(porModulo));

  while (seleccionadas.length < cantidad) {
    let agrego = false;

    for (const modulo of modulos) {
      if (seleccionadas.length >= cantidad) break;

      const preguntasModulo = porModulo[modulo].filter(
        p => !seleccionadas.some(s => s.id === p.id)
      );
      
      if (preguntasModulo.length === 0) continue;

      const porTema = agruparPor(preguntasModulo, p => p.tema);
      const temas = mezclar(Object.keys(porTema));

      for (const tema of temas) {
        const preguntasTema = porTema[tema].filter(
          p => !seleccionadas.some(s => s.id === p.id)
        );

        if (preguntasTema.length > 0) {
          seleccionadas.push(mezclar(preguntasTema)[0]);
          agrego = true;
          break;
        }
      }
    }

    if (!agrego) break;
  }

  // Rellenar si hace falta
  if (seleccionadas.length < cantidad) {
    const restantes = preguntas.filter(p => !seleccionadas.some(s => s.id === p.id));
    seleccionadas.push(...mezclar(restantes).slice(0, cantidad - seleccionadas.length));
  }

  return mezclar(seleccionadas).slice(0, cantidad);
}

/**
 * Agrupa un array por una función clave
 * @param {array} lista - Array a agrupar
 * @param {function} funcionClave - Función que retorna la clave de agrupación
 * @returns {object} Objeto con grupos
 */
function agruparPor(lista, funcionClave) {
  return lista.reduce((grupo, item) => {
    const clave = funcionClave(item) || "General";
    if (!grupo[clave]) grupo[clave] = [];
    grupo[clave].push(item);
    return grupo;
  }, {});
}

/**
 * Mezcla aleatoriamente un array (Fisher-Yates)
 * @param {array} lista - Array a mezclar
 * @returns {array} Array mezclado
 */
function mezclar(lista) {
  const copia = [...lista];

  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }

  return copia;
}

// ========================================
// RENDERIZADO DE PREGUNTAS
// ========================================

/**
 * Renderiza todas las preguntas en el contenedor
 */
function renderizarPreguntas() {
  elementos.contenedorPreguntas.innerHTML = examenActual
    .map((p, index) => {
      return `
        <article class="question-card" id="pregunta-${p.id}">
          <div class="question-meta">
            <span class="badge">Pregunta ${index + 1}</span>
            <span class="badge">${escaparHTML(p.modulo)}</span>
            <span class="badge">${escaparHTML(p.tema)}</span>
            ${p.nivel ? `<span class="badge">${escaparHTML(p.nivel)}</span>` : ""}
          </div>

          <div class="question-title">
            ${escaparHTML(p.pregunta)}
          </div>

          <div class="options">
            ${LETRAS.map(letra => `
              <label class="option">
                <input 
                  type="radio" 
                  name="pregunta_${p.id}" 
                  value="${letra}"
                  onchange="guardarRespuesta(${p.id}, '${letra}')"
                  ${respuestasUsuario[p.id] === letra ? "checked" : ""}
                >
                <span>
                  <strong>${letra})</strong> ${escaparHTML(obtenerTextoOpcion(p, letra))}
                </span>
              </label>
            `).join("")}
          </div>
        </article>
      `;
    })
    .join("");
}

/**
 * Obtiene el texto de una opción específica
 * @param {object} p - Pregunta
 * @param {string} letra - Letra de la opción (A, B, C, D, E)
 * @returns {string} Texto de la opción
 */
function obtenerTextoOpcion(p, letra) {
  const clave = `opcion_${letra.toLowerCase()}`;
  return p[clave] || "";
}

/**
 * Guarda la respuesta del usuario a una pregunta
 * @param {number} idPregunta - ID de la pregunta
 * @param {string} letra - Letra seleccionada
 */
function guardarRespuesta(idPregunta, letra) {
  respuestasUsuario[idPregunta] = letra;
  actualizarProgreso();
}

/**
 * Actualiza la barra de progreso y contador de respondidas
 */
function actualizarProgreso() {
  const respondidas = Object.keys(respuestasUsuario).length;
  const total = examenActual.length;
  const porcentaje = total === 0 ? 0 : Math.round((respondidas / total) * 100);

  elementos.contadorRespondidas.textContent = `${respondidas}/${total} respondidas`;
  elementos.barraProgreso.style.width = `${porcentaje}%`;
}

// ========================================
// TERMINACIÓN Y RESULTADOS
// ========================================

/**
 * Termina el examen y muestra los resultados
 */
function terminarExamen() {
  const total = examenActual.length;
  const respondidas = Object.keys(respuestasUsuario).length;

  if (respondidas < total) {
    const confirmar = confirm(
      `Te faltan ${total - respondidas} preguntas por responder. ¿Deseas terminar de todas formas?`
    );
    if (!confirmar) return;
  }

  // Procesar resultados
  resultadosActuales = examenActual.map(p => {
    const marcada = respuestasUsuario[p.id] || "";
    const correcta = p.respuesta_correcta;
    const estado =
      !marcada ? "blanco" : marcada === correcta ? "correcta" : "incorrecta";

    return {
      ...p,
      marcada,
      correcta,
      estado
    };
  });

  // Guardar en historial
  const historial = obtenerHistorial();
  const idsExamen = examenActual.map(p => p.id);
  guardarHistorial([...historial, ...idsExamen]);

  // Mostrar resultados
  mostrarResultados();

  elementos.examen.classList.add("hidden");
  elementos.resultado.classList.remove("hidden");
  actualizarEstadisticas();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Calcula y muestra los resultados finales
 */
function mostrarResultados() {
  const total = resultadosActuales.length;
  const correctas = resultadosActuales.filter(r => r.estado === "correcta").length;
  const incorrectas = resultadosActuales.filter(r => r.estado === "incorrecta").length;
  const blanco = resultadosActuales.filter(r => r.estado === "blanco").length;
  const porcentaje = total === 0 ? 0 : Math.round((correctas / total) * 100);

  elementos.puntajeFinal.textContent = `${correctas}/${total}`;
  elementos.porcentajeFinal.textContent = `${porcentaje}%`;

  elementos.totalCorrectas.textContent = correctas;
  elementos.totalIncorrectas.textContent = incorrectas;
  elementos.totalBlanco.textContent = blanco;

  // Mostrar revisión completa por defecto
  mostrarRevision("todo");
}

/**
 * Muestra la revisión de las preguntas
 * @param {string} tipo - "todo" o "incorrectas"
 */
function mostrarRevision(tipo) {
  let lista = resultadosActuales;

  if (tipo === "incorrectas") {
    lista = resultadosActuales.filter(r => r.estado !== "correcta");
  }

  elementos.revision.innerHTML = lista
    .map((r, index) => {
      const claseEstado =
        r.estado === "correcta"
          ? "correct-answer"
          : r.estado === "incorrecta"
          ? "wrong-answer"
          : "blank-answer";

      const textoMarcada = r.marcada
        ? `${r.marcada}) ${escaparHTML(obtenerTextoOpcion(r, r.marcada))}`
        : "Sin responder";

      const textoCorrecta = `${r.correcta}) ${escaparHTML(obtenerTextoOpcion(r, r.correcta))}`;

      return `
        <article class="review-card ${claseEstado}">
          <div class="review-meta">
            <span class="badge">Revisión ${index + 1}</span>
            <span class="badge">${escaparHTML(r.estado.toUpperCase())}</span>
            <span class="badge">${escaparHTML(r.tema)}</span>
          </div>

          <div class="review-title">
            ${escaparHTML(r.pregunta)}
          </div>

          <div class="review-info">
            <p><strong>Tu respuesta:</strong> ${escaparHTML(textoMarcada)}</p>
            <p><strong>Respuesta correcta:</strong> ${escaparHTML(textoCorrecta)}</p>
            ${r.respuesta_texto ? `<p><strong>Respuesta clave:</strong> ${escaparHTML(r.respuesta_texto)}</p>` : ""}
          </div>

          ${
            r.explicacion
              ? `
            <div class="explanation">
              <strong>Explicación:</strong> ${escaparHTML(r.explicacion)}
            </div>
          `
              : ""
          }
        </article>
      `;
    })
    .join("");

  if (lista.length === 0) {
    elementos.revision.innerHTML = `
      <div class="alert">
        No hay preguntas para mostrar en esta vista. ¡Excelente trabajo!
      </div>
    `;
  }
}

/**
 * Cancela el examen actual
 */
function cancelarExamen() {
  const confirmar = confirm("¿Seguro que deseas cancelar el examen actual?");
  if (!confirmar) return;

  examenActual = [];
  respuestasUsuario = {};

  elementos.examen.classList.add("hidden");
  elementos.inicio.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Vuelve a la pantalla de inicio desde resultados
 */
function volverInicio() {
  examenActual = [];
  respuestasUsuario = {};
  resultadosActuales = [];

  elementos.resultado.classList.add("hidden");
  elementos.inicio.classList.remove("hidden");

  actualizarEstadisticas();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ========================================
// HISTORIAL Y ALMACENAMIENTO
// ========================================

/**
 * Obtiene el historial de preguntas usadas desde localStorage
 * @returns {array} Array de IDs de preguntas usadas
 */
function obtenerHistorial() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

/**
 * Guarda el historial de preguntas usadas en localStorage
 * @param {array} ids - Array de IDs a guardar
 */
function guardarHistorial(ids) {
  const unicos = [...new Set(ids.map(Number))];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(unicos));
}

/**
 * Reinicia el historial de preguntas usadas
 */
function reiniciarHistorial() {
  const confirmar = confirm(
    "¿Deseas borrar el historial de preguntas usadas? Esto permitirá que preguntas repetidas vuelvan a aparecer."
  );
  if (!confirmar) return;

  localStorage.removeItem(STORAGE_KEY);
  actualizarEstadisticas();
}

/**
 * Actualiza las estadísticas mostradas en la pantalla inicial
 */
function actualizarEstadisticas() {
  const usadas = obtenerHistorial();
  const total = bancoPreguntas.length;
  const disponibles = bancoPreguntas.filter(p => !usadas.includes(p.id)).length;

  elementos.totalPreguntas.textContent = total;
  elementos.preguntasUsadas.textContent = usadas.length;
  elementos.preguntasDisponibles.textContent = disponibles;
}

// ========================================
// UTILIDADES
// ========================================

/**
 * Escapa caracteres HTML para evitar inyección de código
 * @param {string} texto - Texto a escapar
 * @returns {string} Texto escapado
 */
function escaparHTML(texto) {
  return String(texto || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}