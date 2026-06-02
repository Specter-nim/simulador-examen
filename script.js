// ========================================
// Simulador SENATI - script.js (actualizado para 3 modos: mixto/probable/completo)
// ========================================

// Constantes de rutas y almacenamiento
const BANCOS = {
  prioritario: "data/banco_preguntas_prioridad/banco_preguntas_examen_prioritario.json",
  amplio: "data/banco_preguntas_curricular/banco_preguntas_senati_3000.json"
};

const CSV_FILE = "data/banco_preguntas_curricular/banco_preguntas_examen.csv"; // fallback

const STORAGE_KEYS = {
  mixto: "historial_senati_mixto",
  probable: "historial_senati_probable",
  completo: "historial_senati_completo"
};

const LETRAS = ["A", "B", "C", "D", "E"]; // opciones válidas

// Estado
let bancoPreguntas = [];
let bancoPreguntasPrioritario = [];
let bancoPreguntasAmplio = [];
let examenActual = [];
let respuestasUsuario = {};
let resultadosActuales = [];

// Helper DOM
const $ = (id) => document.getElementById(id);

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
  modoPractica: $("modoPractica"),

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

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
  configurarEventos();
  const modoInicial = elementos.modoPractica ? elementos.modoPractica.value : 'mixto';
  await cargarBancoModo(modoInicial);
  elementos.btnIniciar.disabled = bancoPreguntas.length === 0;
  actualizarEstadisticas();
});

// Eventos
function configurarEventos() {
  elementos.btnIniciar.addEventListener('click', iniciarExamen);
  elementos.btnTerminar.addEventListener('click', terminarExamen);
  elementos.btnCancelar.addEventListener('click', cancelarExamen);
  elementos.btnNuevoExamen.addEventListener('click', () => reiniciarParaMismoModo());
  elementos.btnReiniciarHistorial.addEventListener('click', reiniciarHistorial);
  elementos.btnVerIncorrectas.addEventListener('click', () => mostrarRevision('incorrectas'));
  elementos.btnVerTodo.addEventListener('click', () => mostrarRevision('todo'));

  if (elementos.modoPractica) {
    elementos.modoPractica.addEventListener('change', async () => {
      const modo = elementos.modoPractica.value;
      elementos.csvStatus.textContent = 'Cargando banco para modo: ' + modo + '...';
      await cargarBancoModo(modo);
      elementos.btnIniciar.disabled = bancoPreguntas.length === 0;
      actualizarEstadisticas();
    });
  }
}

// -------------------------
// Carga de bancos
// -------------------------
async function cargarJSON(ruta) {
  try {
    const resp = await fetch(ruta);
    if (!resp.ok) throw new Error('no encontrado');
    const datos = await resp.json();
    const arr = Array.isArray(datos) ? datos : datos.preguntas || [];
    return arr.map(normalizarPregunta).filter(validarPregunta);
  } catch (err) {
    return [];
  }
}

async function cargarBancoModo(modo) {
  bancoPreguntas = [];
  bancoPreguntasPrioritario = [];
  bancoPreguntasAmplio = [];

  if (modo === 'probable' || modo === 'mixto') {
    bancoPreguntasPrioritario = await cargarJSON(BANCOS.prioritario);
    if (bancoPreguntasPrioritario.length === 0) {
      // intentar CSV alternativo
      try {
        const csvPath = BANCOS.prioritario.replace('.json', '.csv');
        const txt = await (await fetch(csvPath)).text();
        bancoPreguntasPrioritario = parseCSV(txt).map(normalizarPregunta).filter(validarPregunta);
      } catch (e) {}
    }
  }

  if (modo === 'completo' || modo === 'mixto') {
    bancoPreguntasAmplio = await cargarJSON(BANCOS.amplio);
    if (bancoPreguntasAmplio.length === 0) {
      try {
        const txt = await (await fetch(CSV_FILE)).text();
        bancoPreguntasAmplio = parseCSV(txt).map(normalizarPregunta).filter(validarPregunta);
      } catch (e) {}
    }
  }

  if (modo === 'probable') {
    bancoPreguntas = [...bancoPreguntasPrioritario];
    elementos.csvStatus.textContent = `✓ Banco prioritario cargado: ${bancoPreguntasPrioritario.length} preguntas.`;
  } else if (modo === 'completo') {
    bancoPreguntas = [...bancoPreguntasAmplio];
    elementos.csvStatus.textContent = `✓ Banco amplio cargado: ${bancoPreguntasAmplio.length} preguntas.`;
  } else {
    // mixto: combinar pero mantener arrays separados
    const mapa = new Map();
    for (const p of bancoPreguntasPrioritario) mapa.set(p.id, p);
    for (const p of bancoPreguntasAmplio) if (!mapa.has(p.id)) mapa.set(p.id, p);
    bancoPreguntas = Array.from(mapa.values());
    elementos.csvStatus.textContent = `✓ Bancos cargados (mixto): prioritario ${bancoPreguntasPrioritario.length}, amplio ${bancoPreguntasAmplio.length}, combinadas ${bancoPreguntas.length}.`;
  }

  elementos.csvStatus.classList.remove('error');
  actualizarEstadisticas();
}

// -------------------------
// CSV parsing (existente, robusto)
// -------------------------
function parseCSV(texto) {
  texto = texto.replace(/^\uFEFF/, "");

  const filas = [];
  let fila = [];
  let celda = "";
  let dentroComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const char = texto[i];
    const siguiente = texto[i + 1];

    if (char === '"' && dentroComillas && siguiente === '"') {
      celda += '"';
      i++;
    } else if (char === '"') {
      dentroComillas = !dentroComillas;
    } else if (char === ',' && !dentroComillas) {
      fila.push(celda);
      celda = '';
    } else if ((char === '\n' || char === '\r') && !dentroComillas) {
      if (char === '\r' && siguiente === '\n') i++;
      fila.push(celda);
      if (fila.some(v => v.trim() !== '')) filas.push(fila);
      fila = []; celda = '';
    } else {
      celda += char;
    }
  }

  if (celda.length > 0 || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }

  const encabezados = filas.shift()?.map(h => h.trim()) || [];
  return filas.map(f => {
    const obj = {};
    encabezados.forEach((enc, i) => { obj[enc] = f[i] ? f[i].trim() : ''; });
    return obj;
  });
}

// -------------------------
// Normalización / validación
// -------------------------
function normalizarPregunta(p) {
  return {
    id: p.id ? Number(p.id) : crearIdTemporal(p),
    modulo: p.modulo || p.module || 'General',
    semana: p.semana || '',
    tema: p.tema || 'General',
    subtema: p.subtema || '',
    nivel: p.nivel || '',
    tipo_pregunta: p.tipo_pregunta || '',
    pregunta: p.pregunta || p.question || '',
    opcion_a: p.opcion_a || p.opcionA || '',
    opcion_b: p.opcion_b || p.opcionB || '',
    opcion_c: p.opcion_c || p.opcionC || '',
    opcion_d: p.opcion_d || p.opcionD || '',
    opcion_e: p.opcion_e || p.opcionE || '',
    respuesta_correcta: (p.respuesta_correcta || p.answer || '').toString().toUpperCase().trim(),
    respuesta_texto: p.respuesta_texto || p.answer_text || '',
    explicacion: p.explicacion || p.explicacion || '',
    probabilidad_salida: p.probabilidad_salida || p.probabilidad || '',
    prioridad: p.prioridad || '',
    origen_refuerzo: p.origen_refuerzo || ''
  };
}

function crearIdTemporal(p) {
  const texto = `${p.modulo || ''}-${p.tema || ''}-${p.pregunta || p.question || ''}`;
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = ((hash << 5) - hash) + texto.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function validarPregunta(p) {
  const tieneOpcionesMinimas = p.opcion_a && p.opcion_b && p.opcion_c && p.opcion_d && p.opcion_e;
  const tieneRespuestaValida = p.respuesta_correcta && LETRAS.includes(p.respuesta_correcta);
  return p.pregunta && tieneOpcionesMinimas && tieneRespuestaValida;
}

// -------------------------
// Selección de preguntas
// -------------------------
function seleccionarPreguntas(cantidad, modoSeleccion, modoPractica) {
  modoSeleccion = modoSeleccion || 'balanceado';
  modoPractica = modoPractica || (elementos.modoPractica ? elementos.modoPractica.value : 'mixto');

  if (modoPractica === 'probable') {
    return seleccionarDesdeBanco(bancoPreguntasPrioritario, cantidad, modoSeleccion, modoPractica);
  }

  if (modoPractica === 'completo') {
    return seleccionarDesdeBanco(bancoPreguntasAmplio, cantidad, modoSeleccion, modoPractica);
  }

  // Mixto: 70% prioritario, 30% amplio
  const prioridadCount = Math.round(cantidad * 0.7);
  const amplioCount = cantidad - prioridadCount;

  const partePrioritario = seleccionarDesdeBanco(bancoPreguntasPrioritario, prioridadCount, modoSeleccion, modoPractica);
  let parteAmplio = seleccionarDesdeBanco(bancoPreguntasAmplio, amplioCount, modoSeleccion, modoPractica);

  const idsPrior = new Set(partePrioritario.map(p => p.id));
  parteAmplio = parteAmplio.filter(p => !idsPrior.has(p.id));

  if (partePrioritario.length + parteAmplio.length < cantidad) {
    const faltan = cantidad - (partePrioritario.length + parteAmplio.length);
    const poolAmplio = bancoPreguntasAmplio.filter(p => ![...partePrioritario, ...parteAmplio].some(x => x.id === p.id));
    parteAmplio = parteAmplio.concat(mezclar(poolAmplio).slice(0, faltan));
  }

  return mezclar([...partePrioritario, ...parteAmplio]).slice(0, cantidad);
}

function seleccionarDesdeBanco(banco, cantidad, modoSeleccion, modoPractica) {
  modoSeleccion = modoSeleccion || 'balanceado';
  modoPractica = modoPractica || 'mixto';

  const historial = new Set(obtenerHistorial(modoPractica));
  const sinUsar = banco.filter(p => !historial.has(p.id));

  let seleccion = [];

  if (sinUsar.length >= cantidad) {
    seleccion = modoSeleccion === 'balanceado' ? seleccionarBalanceado(sinUsar, cantidad) : mezclar(sinUsar).slice(0, cantidad);
  } else {
    seleccion = sinUsar.slice();
    const usados = banco.filter(p => historial.has(p.id) && !seleccion.some(s => s.id === p.id));
    const faltan = cantidad - seleccion.length;
    seleccion = seleccion.concat(mezclar(usados).slice(0, faltan));
  }

  return seleccion.slice(0, cantidad);
}

// Mantener las funciones originales de selección balanceada/agrupación
function seleccionarBalanceado(preguntas, cantidad) {
  const seleccionadas = [];
  const porModulo = agruparPor(preguntas, p => p.modulo);
  const modulos = mezclar(Object.keys(porModulo));

  while (seleccionadas.length < cantidad) {
    let agrego = false;
    for (const modulo of modulos) {
      if (seleccionadas.length >= cantidad) break;
      const preguntasModulo = porModulo[modulo].filter(p => !seleccionadas.some(s => s.id === p.id));
      if (preguntasModulo.length === 0) continue;
      const porTema = agruparPor(preguntasModulo, p => p.tema);
      const temas = mezclar(Object.keys(porTema));
      for (const tema of temas) {
        const preguntasTema = porTema[tema].filter(p => !seleccionadas.some(s => s.id === p.id));
        if (preguntasTema.length > 0) {
          seleccionadas.push(mezclar(preguntasTema)[0]);
          agrego = true;
          break;
        }
      }
    }
    if (!agrego) break;
  }

  if (seleccionadas.length < cantidad) {
    const restantes = preguntas.filter(p => !seleccionadas.some(s => s.id === p.id));
    seleccionadas.push(...mezclar(restantes).slice(0, cantidad - seleccionadas.length));
  }

  return mezclar(seleccionadas).slice(0, cantidad);
}

function agruparPor(lista, funcionClave) {
  return lista.reduce((grupo, item) => {
    const clave = funcionClave(item) || 'General';
    if (!grupo[clave]) grupo[clave] = [];
    grupo[clave].push(item);
    return grupo;
  }, {});
}

function mezclar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// -------------------------
// Renderizado y flujo de examen (similar a original)
// -------------------------
function renderizarPreguntas() {
  elementos.contenedorPreguntas.innerHTML = examenActual.map((p, index) => `
    <article class="question-card" id="pregunta-${p.id}">
      <div class="question-meta">
        <span class="badge">Pregunta ${index + 1}</span>
        <span class="badge">${escaparHTML(p.modulo)}</span>
        <span class="badge">${escaparHTML(p.tema)}</span>
        ${p.nivel ? `<span class="badge">${escaparHTML(p.nivel)}</span>` : ''}
      </div>

      <div class="question-title">${escaparHTML(p.pregunta)}</div>

      <div class="options">
        ${LETRAS.map(letra => `
          <label class="option">
            <input type="radio" name="pregunta_${p.id}" value="${letra}" onchange="guardarRespuesta(${p.id}, '${letra}')" ${respuestasUsuario[p.id] === letra ? 'checked' : ''}>
            <span><strong>${letra})</strong> ${escaparHTML(obtenerTextoOpcion(p, letra))}</span>
          </label>
        `).join('')}
      </div>
    </article>
  `).join('');
}

function obtenerTextoOpcion(p, letra) {
  const clave = `opcion_${letra.toLowerCase()}`;
  return p[clave] || '';
}

function guardarRespuesta(idPregunta, letra) {
  respuestasUsuario[idPregunta] = letra;
  actualizarProgreso();
}

function actualizarProgreso() {
  const respondidas = Object.keys(respuestasUsuario).length;
  const total = examenActual.length;
  const porcentaje = total === 0 ? 0 : Math.round((respondidas / total) * 100);
  elementos.contadorRespondidas.textContent = `${respondidas}/${total} respondidas`;
  elementos.barraProgreso.style.width = `${porcentaje}%`;
}

function iniciarExamen() {
  const cantidad = Number(elementos.cantidadPreguntas.value);
  const modoSeleccion = elementos.modoSeleccion.value;
  const modoPractica = elementos.modoPractica ? elementos.modoPractica.value : 'mixto';

  examenActual = seleccionarPreguntas(cantidad, modoSeleccion, modoPractica);
  respuestasUsuario = {};

  if (examenActual.length === 0) {
    alert('No hay preguntas disponibles. Reinicia el historial e intenta nuevamente.');
    return;
  }

  renderizarPreguntas();
  elementos.inicio.classList.add('hidden');
  elementos.resultado.classList.add('hidden');
  elementos.examen.classList.remove('hidden');
  actualizarProgreso();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function terminarExamen() {
  const total = examenActual.length;
  const respondidas = Object.keys(respuestasUsuario).length;
  if (respondidas < total) {
    const confirmar = confirm(`Te faltan ${total - respondidas} preguntas por responder. ¿Deseas terminar de todas formas?`);
    if (!confirmar) return;
  }

  resultadosActuales = examenActual.map(p => {
    const marcada = respuestasUsuario[p.id] || '';
    const correcta = p.respuesta_correcta;
    const estado = !marcada ? 'blanco' : marcada === correcta ? 'correcta' : 'incorrecta';
    return { ...p, marcada, correcta, estado };
  });

  // Guardar en historial según modo
  const modoPractica = elementos.modoPractica ? elementos.modoPractica.value : 'mixto';
  const idsExamen = examenActual.map(p => p.id);
  guardarHistorial(modoPractica, idsExamen);

  mostrarResultados();
  elementos.examen.classList.add('hidden');
  elementos.resultado.classList.remove('hidden');
  actualizarEstadisticas();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function mostrarResultados() {
  const total = resultadosActuales.length;
  const correctas = resultadosActuales.filter(r => r.estado === 'correcta').length;
  const incorrectas = resultadosActuales.filter(r => r.estado === 'incorrecta').length;
  const blanco = resultadosActuales.filter(r => r.estado === 'blanco').length;
  const porcentaje = total === 0 ? 0 : Math.round((correctas / total) * 100);

  elementos.puntajeFinal.textContent = `${correctas}/${total}`;
  elementos.porcentajeFinal.textContent = `${porcentaje}%`;
  elementos.totalCorrectas.textContent = correctas;
  elementos.totalIncorrectas.textContent = incorrectas;
  elementos.totalBlanco.textContent = blanco;

  mostrarRevision('todo');
}

function mostrarRevision(tipo) {
  let lista = resultadosActuales;
  if (tipo === 'incorrectas') lista = resultadosActuales.filter(r => r.estado !== 'correcta');

  elementos.revision.innerHTML = lista.map((r, index) => {
    const clase = r.estado === 'correcta' ? 'correct-answer' : r.estado === 'incorrecta' ? 'wrong-answer' : 'blank-answer';
    const textoMarcada = r.marcada ? `${r.marcada}) ${escaparHTML(obtenerTextoOpcion(r, r.marcada))}` : 'Sin responder';
    const textoCorrecta = `${r.correcta}) ${escaparHTML(obtenerTextoOpcion(r, r.correcta))}`;
    return `
      <article class="review-card ${clase}">
        <div class="review-meta">
          <span class="badge">Revisión ${index + 1}</span>
          <span class="badge">${escaparHTML(r.estado.toUpperCase())}</span>
          <span class="badge">${escaparHTML(r.tema)}</span>
        </div>
        <div class="review-title">${escaparHTML(r.pregunta)}</div>
        <div class="review-info">
          <p><strong>Tu respuesta:</strong> ${escaparHTML(textoMarcada)}</p>
          <p><strong>Respuesta correcta:</strong> ${escaparHTML(textoCorrecta)}</p>
          ${r.respuesta_texto ? `<p><strong>Respuesta clave:</strong> ${escaparHTML(r.respuesta_texto)}</p>` : ''}
        </div>
        ${r.explicacion ? `<div class="explanation"><strong>Explicación:</strong> ${escaparHTML(r.explicacion)}</div>` : ''}
      </article>
    `;
  }).join('');

  if (lista.length === 0) elementos.revision.innerHTML = `<div class="alert">No hay preguntas para mostrar en esta vista. ¡Excelente trabajo!</div>`;
}

function cancelarExamen() {
  const confirmar = confirm('¿Seguro que deseas cancelar el examen actual?');
  if (!confirmar) return;
  examenActual = [];
  respuestasUsuario = {};
  elementos.examen.classList.add('hidden');
  elementos.inicio.classList.remove('hidden');
}

function reiniciarParaMismoModo() {
  // Genera otro examen con mismo modo
  const modoSeleccion = elementos.modoSeleccion.value;
  const modoPractica = elementos.modoPractica ? elementos.modoPractica.value : 'mixto';
  examenActual = seleccionarPreguntas(Number(elementos.cantidadPreguntas.value), modoSeleccion, modoPractica);
  respuestasUsuario = {};
  renderizarPreguntas();
  elementos.examen.classList.remove('hidden');
  elementos.resultado.classList.add('hidden');
  actualizarProgreso();
}

// -------------------------
// Historial por modo
// -------------------------
function obtenerHistorial(modoPractica = 'mixto') {
  try {
    const key = STORAGE_KEYS[modoPractica] || STORAGE_KEYS.mixto;
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

function guardarHistorial(modoPractica, ids) {
  try {
    const key = STORAGE_KEYS[modoPractica] || STORAGE_KEYS.mixto;
    const actuales = obtenerHistorial(modoPractica) || [];
    const combinados = [...new Set([...actuales.map(Number), ...ids.map(Number)])];
    localStorage.setItem(key, JSON.stringify(combinados));
  } catch (e) {}
}

function reiniciarHistorial() {
  const confirmar = confirm('¿Deseas borrar el historial del modo seleccionado? Esto permitirá que preguntas repetidas vuelvan a aparecer.');
  if (!confirmar) return;
  const modoPractica = elementos.modoPractica ? elementos.modoPractica.value : 'mixto';
  const key = STORAGE_KEYS[modoPractica] || STORAGE_KEYS.mixto;
  localStorage.removeItem(key);
  actualizarEstadisticas();
}

function actualizarEstadisticas() {
  const modo = elementos.modoPractica ? elementos.modoPractica.value : 'mixto';
  const usadas = obtenerHistorial(modo) || [];
  const total = bancoPreguntas.length;
  const disponibles = bancoPreguntas.filter(p => !usadas.includes(p.id)).length;
  elementos.totalPreguntas.textContent = total;
  elementos.preguntasUsadas.textContent = usadas.length;
  elementos.preguntasDisponibles.textContent = disponibles;
}

// -------------------------
// Utilidades
// -------------------------
function escaparHTML(texto) {
  return String(texto || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Export para debugging (opcional)
window._simulador = {
  seleccionarPreguntas, seleccionarDesdeBanco, cargarBancoModo, obtenerHistorial
};

  contadorRespondidas: $('contadorRespondidas'),
  barraProgreso: $('barraProgreso'),

  puntajeFinal: $('puntajeFinal'),
  porcentajeFinal: $('porcentajeFinal'),
  totalCorrectas: $('totalCorrectas'),
  totalIncorrectas: $('totalIncorrectas'),
  totalBlanco: $('totalBlanco'),
  revision: $('revision')
};

document.addEventListener('DOMContentLoaded', iniciarApp);

async function iniciarApp(){
  configurarEventos();
  const modo = elementos.modoPractica ? elementos.modoPractica.value : 'mixto';
  elementos.csvStatus.textContent = 'Cargando bancos ('+modo+')...';
  await cargarBancoModo(modo);
  elementos.btnIniciar.disabled = bancoPreguntas.length === 0;
  actualizarEstadisticas();
}

function configurarEventos(){
  elementos.btnIniciar.addEventListener('click', iniciarExamen);
  elementos.btnTerminar.addEventListener('click', terminarExamen);
  elementos.btnCancelar.addEventListener('click', cancelarExamen);
  // Dar otro examen -> generar otro examen con mismo modo
  elementos.btnNuevoExamen.addEventListener('click', () => {
    // Limpiar respuestas previas y generar nuevo examen
    respuestasUsuario = {};
    examenActual = [];
    iniciarExamen();
  });
  elementos.btnReiniciarHistorial.addEventListener('click', reiniciarHistorial);
  elementos.btnVerIncorrectas.addEventListener('click', () => mostrarRevision('incorrectas'));
  elementos.btnVerTodo.addEventListener('click', () => mostrarRevision('todo'));

  if (elementos.modoPractica) {
    elementos.modoPractica.addEventListener('change', async () => {
      const modo = elementos.modoPractica.value;
      elementos.csvStatus.textContent = 'Cargando bancos ('+modo+')...';
      await cargarBancoModo(modo);
      elementos.btnIniciar.disabled = bancoPreguntas.length === 0;
      actualizarEstadisticas();
    });
  }
}

// -------- Carga de bancos --------
async function cargarJSON(ruta){
  try{
    const r = await fetch(ruta);
    if(!r.ok) throw new Error('no encontrado');
    const j = await r.json();
    const arr = Array.isArray(j) ? j : j.preguntas || [];
    return arr.map(normalizarPregunta).filter(validarPregunta);
  }catch(e){
    return [];
  }
}

async function cargarBancoModo(modo){
  bancoPreguntas = [];
  bancoPreguntasPrioritario = [];
  bancoPreguntasAmplio = [];

  if(modo === 'probable' || modo === 'mixto'){
    bancoPreguntasPrioritario = await cargarJSON(BANCOS.prioritario);
    if(bancoPreguntasPrioritario.length === 0){
      // intentar CSV prioritario
      try{
        const csvPath = BANCOS.prioritario.replace('.json', '.csv');
        const txt = await (await fetch(csvPath)).text();
        bancoPreguntasPrioritario = parseCSV(txt).map(normalizarPregunta).filter(validarPregunta);
      }catch(e){}
    }
  }

  if(modo === 'completo' || modo === 'mixto'){
    bancoPreguntasAmplio = await cargarJSON(BANCOS.amplio);
    if(bancoPreguntasAmplio.length === 0){
      try{
        const txt = await (await fetch(CSV_FILE)).text();
        bancoPreguntasAmplio = parseCSV(txt).map(normalizarPregunta).filter(validarPregunta);
      }catch(e){}
    }
  }

  if(modo === 'probable'){
    bancoPreguntas = [...bancoPreguntasPrioritario];
    elementos.csvStatus.textContent = `✓ Banco prioritario cargado: ${bancoPreguntasPrioritario.length} preguntas.`;
  } else if(modo === 'completo'){
    bancoPreguntas = [...bancoPreguntasAmplio];
    elementos.csvStatus.textContent = `✓ Banco amplio cargado: ${bancoPreguntasAmplio.length} preguntas.`;
  } else {
    // mixto: combinar sin duplicados (prioritario preferente)
    const map = new Map();
    for(const p of bancoPreguntasPrioritario) map.set(p.id, p);
    for(const p of bancoPreguntasAmplio) if(!map.has(p.id)) map.set(p.id, p);
    bancoPreguntas = Array.from(map.values());
    elementos.csvStatus.textContent = `✓ Bancos mixtos: prioritario ${bancoPreguntasPrioritario.length}, amplio ${bancoPreguntasAmplio.length}, combinadas ${bancoPreguntas.length}.`;
  }
  elementos.csvStatus.classList.remove('error');
}

// -------- CSV parser (conservado) --------
function parseCSV(texto){
  texto = texto.replace(/^\uFEFF/, '');
  const filas = [];
  let fila = [];
  let celda = '';
  let dentro = false;

  for(let i=0;i<texto.length;i++){
    const ch = texto[i];
    const sig = texto[i+1];
    if(ch === '"' && dentro && sig === '"'){ celda += '"'; i++; }
    else if(ch === '"'){ dentro = !dentro; }
    else if(ch === ',' && !dentro){ fila.push(celda); celda=''; }
    else if((ch === '\n' || ch === '\r') && !dentro){ if(ch === '\r' && sig === '\n') i++; fila.push(celda); if(fila.some(v=>v.trim()!=='')) filas.push(fila); fila = []; celda = ''; }
    else { celda += ch; }
  }
  if(celda.length>0 || fila.length>0){ fila.push(celda); filas.push(fila); }
  const encabezados = filas.shift()?.map(h=>h.trim()) || [];
  return filas.map(row => { const obj = {}; encabezados.forEach((h,i)=> obj[h] = row[i] ? row[i].trim() : ''); return obj; });
}

// -------- Normalización y validación --------
function normalizarPregunta(p){
  return {
    id: p.id ? (Number(p.id) || p.id) : crearIdTemporal(p),
    modulo: p.modulo || p.modulo || 'General',
    semana: p.semana || '',
    tema: p.tema || 'General',
    subtema: p.subtema || '',
    nivel: p.nivel || '',
    tipo_pregunta: p.tipo_pregunta || '',
    pregunta: p.pregunta || p.enunciado || '',
    opcion_a: p.opcion_a || p.a || '',
    opcion_b: p.opcion_b || p.b || '',
    opcion_c: p.opcion_c || p.c || '',
    opcion_d: p.opcion_d || p.d || '',
    opcion_e: p.opcion_e || p.e || '',
    respuesta_correcta: (p.respuesta_correcta || p.correcta || '').toUpperCase().trim(),
    respuesta_texto: p.respuesta_texto || '',
    explicacion: p.explicacion || p.explicacion || '',
    probabilidad_salida: p.probabilidad_salida || '',
    prioridad: p.prioridad || '',
    origen_refuerzo: p.origen_refuerzo || '',
    fuente_base: p.fuente_base || '',
    tags: p.tags || ''
  };
}

function crearIdTemporal(p){
  const texto = `${p.modulo || ''}-${p.tema || ''}-${p.pregunta || ''}`;
  let h = 0; for(let i=0;i<texto.length;i++){ h = ((h<<5)-h) + texto.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

function validarPregunta(p){
  const tieneOpciones = p.opcion_a && p.opcion_b && p.opcion_c && p.opcion_d && p.opcion_e;
  const respuestaValida = p.respuesta_correcta && LETRAS.includes(p.respuesta_correcta);
  return p.pregunta && tieneOpciones && respuestaValida;
}

// -------- Selección de preguntas --------
function seleccionarPreguntas(cantidad, modoSeleccion, modoPractica){
  modoSeleccion = modoSeleccion || 'balanceado';
  modoPractica = modoPractica || (elementos.modoPractica ? elementos.modoPractica.value : 'mixto');

  if(modoPractica === 'probable'){
    return seleccionarDesdeBanco(bancoPreguntasPrioritario, cantidad, modoSeleccion, modoPractica);
  }
  if(modoPractica === 'completo'){
    return seleccionarDesdeBanco(bancoPreguntasAmplio, cantidad, modoSeleccion, modoPractica);
  }

  // mixto
  const prioridadCount = Math.round(cantidad * 0.7);
  const amplioCount = cantidad - prioridadCount;
  const partePrior = seleccionarDesdeBanco(bancoPreguntasPrioritario, prioridadCount, modoSeleccion, modoPractica);
  let parteAmplio = seleccionarDesdeBanco(bancoPreguntasAmplio, amplioCount, modoSeleccion, modoPractica);

  const idsPrior = new Set(partePrior.map(p=>p.id));
  parteAmplio = parteAmplio.filter(p=>!idsPrior.has(p.id));

  if(partePrior.length + parteAmplio.length < cantidad){
    const faltan = cantidad - (partePrior.length + parteAmplio.length);
    const pool = bancoPreguntasAmplio.filter(p=> ![...partePrior,...parteAmplio].some(x=>x.id===p.id));
    parteAmplio = parteAmplio.concat(mezclar(pool).slice(0,faltan));
  }

  return mezclar([...partePrior, ...parteAmplio]).slice(0, cantidad);
}

function seleccionarDesdeBanco(banco, cantidad, modoSeleccion, modoPractica){
  modoSeleccion = modoSeleccion || 'balanceado';
  const historial = new Set(obtenerHistorial(modoPractica));
  const sinUsar = banco.filter(p => !historial.has(p.id));
  let seleccion = [];
  if(sinUsar.length >= cantidad){
    seleccion = modoSeleccion === 'balanceado' ? seleccionarBalanceado(sinUsar, cantidad) : mezclar(sinUsar).slice(0,cantidad);
  } else {
    seleccion = sinUsar.slice();
    const usados = banco.filter(p => historial.has(p.id) && !seleccion.some(s=>s.id===p.id));
    const faltan = cantidad - seleccion.length;
    seleccion = seleccion.concat(mezclar(usados).slice(0,faltan));
  }
  return seleccion.slice(0,cantidad);
}

function seleccionarBalanceado(preguntas, cantidad){
  const seleccionadas = [];
  const porModulo = agruparPor(preguntas, p=>p.modulo);
  const modulos = mezclar(Object.keys(porModulo));
  while(seleccionadas.length < cantidad){
    let agrego = false;
    for(const modulo of modulos){
      if(seleccionadas.length >= cantidad) break;
      const poolModulo = porModulo[modulo].filter(p => !seleccionadas.some(s=>s.id===p.id));
      if(poolModulo.length===0) continue;
      const porTema = agruparPor(poolModulo, p=>p.tema);
      const temas = mezclar(Object.keys(porTema));
      for(const tema of temas){
        const poolTema = porTema[tema].filter(p=> !seleccionadas.some(s=>s.id===p.id));
        if(poolTema.length>0){ seleccionadas.push(mezclar(poolTema)[0]); agrego=true; break; }
      }
    }
    if(!agrego) break;
  }
  if(seleccionadas.length < cantidad){
    const restantes = preguntas.filter(p=> !seleccionadas.some(s=>s.id===p.id));
    seleccionadas.push(...mezclar(restantes).slice(0, cantidad - seleccionadas.length));
  }
  return mezclar(seleccionadas).slice(0,cantidad);
}

function agruparPor(lista, fn){
  return lista.reduce((acc,item)=>{ const k = fn(item) || 'General'; (acc[k]=acc[k]||[]).push(item); return acc; }, {});
}

function mezclar(arr){ const c=[...arr]; for(let i=c.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [c[i],c[j]]=[c[j],c[i]];} return c; }

// -------- Render y flujo --------
function renderizarPreguntas(){
  elementos.contenedorPreguntas.innerHTML = examenActual.map((p,idx)=>{
    return `
      <article class="question-card" id="pregunta-${p.id}">
        <div class="question-meta">
          <span class="badge">Pregunta ${idx+1}</span>
          <span class="badge">${escaparHTML(p.modulo)}</span>
          <span class="badge">${escaparHTML(p.tema)}</span>
          ${p.nivel?`<span class="badge">${escaparHTML(p.nivel)}</span>`:''}
        </div>
        <div class="question-title">${escaparHTML(p.pregunta)}</div>
        <div class="options">
          ${LETRAS.map(letra=>`
            <label class="option">
              <input type="radio" name="pregunta_${p.id}" value="${letra}" onchange="guardarRespuesta('${p.id}','${letra}')" ${respuestasUsuario[p.id]===letra? 'checked':''}>
              <span><strong>${letra})</strong> ${escaparHTML(obtenerTextoOpcion(p,letra))}</span>
            </label>
          `).join('')}
        </div>
      </article>
    `;
  }).join('');
}

function obtenerTextoOpcion(p, letra){ const clave = `opcion_${letra.toLowerCase()}`; return p[clave]||''; }

function guardarRespuesta(id, letra){ respuestasUsuario[id]=letra; actualizarProgreso(); }

function actualizarProgreso(){ const respondidas = Object.keys(respuestasUsuario).length; const total = examenActual.length; const porcentaje = total===0?0:Math.round((respondidas/total)*100); elementos.contadorRespondidas.textContent = `${respondidas}/${total} respondidas`; elementos.barraProgreso.style.width = `${porcentaje}%`; }

function iniciarExamen(){
  const cantidad = Number(elementos.cantidadPreguntas.value);
  const modoSeleccion = elementos.modoSeleccion.value;
  const modoPractica = elementos.modoPractica ? elementos.modoPractica.value : 'mixto';
  if(!bancoPreguntas || bancoPreguntas.length === 0){ alert('No hay preguntas cargadas para el modo seleccionado.'); return; }
  examenActual = seleccionarPreguntas(cantidad, modoSeleccion, modoPractica);
  respuestasUsuario = {};
  if(examenActual.length===0){ alert('No se pudieron seleccionar preguntas. Reinicia el historial o cambia modo.'); return; }
  renderizarPreguntas(); elementos.inicio.classList.add('hidden'); elementos.resultado.classList.add('hidden'); elementos.examen.classList.remove('hidden'); actualizarProgreso(); window.scrollTo({top:0, behavior:'smooth'});
}

function terminarExamen(){
  const total = examenActual.length; const respondidas = Object.keys(respuestasUsuario).length;
  if(respondidas < total){ const confirmar = confirm(`Te faltan ${total-respondidas} preguntas por responder. ¿Deseas terminar de todas formas?`); if(!confirmar) return; }

  resultadosActuales = examenActual.map(p=>{ const marcada = respuestasUsuario[p.id] || ''; const correcta = p.respuesta_correcta; const estado = !marcada ? 'blanco' : marcada === correcta ? 'correcta' : 'incorrecta'; return {...p, marcada, correcta, estado}; });

  // Guardar historial por modo
  const modoPractica = elementos.modoPractica ? elementos.modoPractica.value : 'mixto';
  const idsExamen = examenActual.map(p=>p.id);
  guardarHistorial(modoPractica, idsExamen);

  mostrarResultados(); elementos.examen.classList.add('hidden'); elementos.resultado.classList.remove('hidden'); actualizarEstadisticas(); window.scrollTo({top:0, behavior:'smooth'});
}

function mostrarResultados(){
  const total = resultadosActuales.length; const correctas = resultadosActuales.filter(r=>r.estado==='correcta').length; const incorrectas = resultadosActuales.filter(r=>r.estado==='incorrecta').length; const blanco = resultadosActuales.filter(r=>r.estado==='blanco').length; const porcentaje = total===0?0:Math.round((correctas/total)*100);
  elementos.puntajeFinal.textContent = `${correctas}/${total}`; elementos.porcentajeFinal.textContent = `${porcentaje}%`; elementos.totalCorrectas.textContent = correctas; elementos.totalIncorrectas.textContent = incorrectas; elementos.totalBlanco.textContent = blanco; mostrarRevision('todo');
}

function mostrarRevision(tipo){
  let lista = resultadosActuales; if(tipo==='incorrectas') lista = resultadosActuales.filter(r=>r.estado!=='correcta');
  elementos.revision.innerHTML = lista.map((r,idx)=>{
    const clase = r.estado==='correcta'?'correct-answer': r.estado==='incorrecta'?'wrong-answer':'blank-answer';
    const textoMarcada = r.marcada ? `${r.marcada}) ${escaparHTML(obtenerTextoOpcion(r,r.marcada))}` : 'Sin responder';
    const textoCorrecta = `${r.correcta}) ${escaparHTML(obtenerTextoOpcion(r,r.correcta))}`;
    return `
      <article class="review-card ${clase}">
        <div class="review-meta">
          <span class="badge">Revisión ${idx+1}</span>
          <span class="badge">${escaparHTML(r.estado.toUpperCase())}</span>
          <span class="badge">${escaparHTML(r.modulo)}</span>
          <span class="badge">${escaparHTML(r.tema)}</span>
        </div>
        <div class="review-title">${escaparHTML(r.pregunta)}</div>
        <div class="review-info">
          <p><strong>Tu respuesta:</strong> ${escaparHTML(textoMarcada)}</p>
          <p><strong>Respuesta correcta:</strong> ${escaparHTML(textoCorrecta)}</p>
          ${r.respuesta_texto?`<p><strong>Respuesta clave:</strong> ${escaparHTML(r.respuesta_texto)}</p>`:''}
        </div>
        ${r.explicacion?`<div class="explanation"><strong>Explicación:</strong> ${escaparHTML(r.explicacion)}</div>`:''}
      </article>
    `;
  }).join('');
  if(lista.length===0) elementos.revision.innerHTML = `<div class="alert">No hay preguntas para mostrar en esta vista.</div>`;
}

function cancelarExamen(){ const confirmar = confirm('¿Seguro que deseas cancelar el examen actual?'); if(!confirmar) return; examenActual=[]; respuestasUsuario={}; elementos.examen.classList.add('hidden'); elementos.inicio.classList.remove('hidden'); window.scrollTo({top:0, behavior:'smooth'}); }

// -------- Historial (por modo) --------
function obtenerHistorial(modo){ modo = modo || (elementos.modoPractica?elementos.modoPractica.value:'mixto'); const key = STORAGE_KEYS[modo] || STORAGE_KEYS.mixto; try{ return JSON.parse(localStorage.getItem(key) || '[]'); }catch{ return []; } }

function guardarHistorial(ids, modo){ modo = modo || (elementos.modoPractica?elementos.modoPractica.value:'mixto'); const key = STORAGE_KEYS[modo] || STORAGE_KEYS.mixto; const actuales = obtenerHistorial(modo); const unidos = [...new Set([...(actuales||[]), ...ids.map(Number)])]; localStorage.setItem(key, JSON.stringify(unidos)); }

function reiniciarHistorial(){ const modo = elementos.modoPractica ? elementos.modoPractica.value : 'mixto'; const key = STORAGE_KEYS[modo] || STORAGE_KEYS.mixto; const confirmar = confirm('¿Deseas borrar el historial de preguntas usadas para el modo seleccionado?'); if(!confirmar) return; localStorage.removeItem(key); actualizarEstadisticas(); }

function actualizarEstadisticas(){ const modo = elementos.modoPractica ? elementos.modoPractica.value : 'mixto'; const usadas = obtenerHistorial(modo); let total = 0; if(modo==='probable') total = bancoPreguntasPrioritario.length; else if(modo==='completo') total = bancoPreguntasAmplio.length; else { const map = new Map(); bancoPreguntasPrioritario.forEach(p=>map.set(p.id,p)); bancoPreguntasAmplio.forEach(p=>{ if(!map.has(p.id)) map.set(p.id,p); }); total = map.size; }
  const disponibles = Math.max(0, total - (usadas?usadas.length:0)); elementos.totalPreguntas.textContent = total; elementos.preguntasUsadas.textContent = usadas ? usadas.length : 0; elementos.preguntasDisponibles.textContent = disponibles; }

// -------- Utilidades --------
function escaparHTML(texto){ return String(texto||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;"); }

// Exponer guardarRespuesta global para inputs inline
window.guardarRespuesta = guardarRespuesta;
