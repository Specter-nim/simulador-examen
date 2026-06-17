// ========================================
// Simulador SENATI - script.js (actualizado para selección de banco: normal/prioritario/prioritarioV2)
// ========================================

// Constantes de rutas y almacenamiento
const BANCOS = {
  prioritario: "data/banco_preguntas_prioridad_v2/banco_prioritario_v3_con_preguntas_probables.json",
  normal: "data/banco_preguntas_normal/banco_normal_repaso_v3_con_preguntas_probables.json"
};
const BANCOS_V2 = {
  prioritarioV2: "data/banco_preguntas_prioridad_v2/banco_prioritario_v3_con_preguntas_probables.json"
};

const CSV_FILE = "data/banco_preguntas_normal/banco_normal_repaso_v3_con_preguntas_probables.csv"; // fallback

const STORAGE_KEYS = {
  normal: "historial_senati_normal",
  prioritario: "historial_senati_prioritario",
  prioritarioV2: "historial_senati_prioritario_v2",
  mixto: "historial_senati_mixto"
};

const LETRAS = ["A", "B", "C", "D", "E"]; // opciones vÃ¡lidas

// Estado
let bancoPreguntas = [];
let bancoPreguntasPrioritario = [];
let bancoPreguntasNormal = [];
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

// InicializaciÃ³n
document.addEventListener('DOMContentLoaded', async () => {
  configurarEventos();
  const modoInicial = elementos.modoPractica ? elementos.modoPractica.value : 'normal';
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
    return dedupePreguntas(arr.map(normalizarPregunta).filter(validarPregunta));
  } catch (err) {
    return [];
  }
}

async function cargarBancoModo(modo) {
  bancoPreguntas = [];
  bancoPreguntasPrioritario = [];
  bancoPreguntasNormal = [];

  if (modo === 'prioritario' || modo === 'prioritarioV2' || modo === 'mixto') {
    const rutaPrioritario = modo === 'prioritarioV2' ? BANCOS_V2.prioritarioV2 : BANCOS.prioritario;
    bancoPreguntasPrioritario = ordenarBancoPrioritario(await cargarJSON(rutaPrioritario));
    if (bancoPreguntasPrioritario.length === 0) {
      // intentar CSV alternativo
      try {
        const csvPath = rutaPrioritario.replace('.json', '.csv');
        const txt = await (await fetch(csvPath)).text();
        bancoPreguntasPrioritario = ordenarBancoPrioritario(dedupePreguntas(parseCSV(txt).map(normalizarPregunta).filter(validarPregunta)));
      } catch (e) {}
    }
  }

  if (modo === 'normal' || modo === 'mixto') {
    bancoPreguntasNormal = await cargarJSON(BANCOS.normal);
    if (bancoPreguntasNormal.length === 0) {
      try {
        const txt = await (await fetch(CSV_FILE)).text();
        bancoPreguntasNormal = dedupePreguntas(parseCSV(txt).map(normalizarPregunta).filter(validarPregunta));
      } catch (e) {}
    }
  }

  if (modo === 'prioritario' || modo === 'prioritarioV2') {
    bancoPreguntas = [...bancoPreguntasPrioritario];
    elementos.csvStatus.textContent = `✔ Banco prioritario cargado: ${bancoPreguntasPrioritario.length} preguntas.`;
  } else if (modo === 'normal') {
    bancoPreguntas = [...bancoPreguntasNormal];
    elementos.csvStatus.textContent = `✔ Banco normal cargado: ${bancoPreguntasNormal.length} preguntas.`;
  } else {
    // mixto 50/50 entre prioritario y normal (datos separados)
    bancoPreguntas = [...bancoPreguntasPrioritario, ...bancoPreguntasNormal];
    elementos.csvStatus.textContent = `✔ Bancos cargados (mixto 50/50): prioritario ${bancoPreguntasPrioritario.length}, normal ${bancoPreguntasNormal.length}.`;
  }

  elementos.csvStatus.classList.remove('error');
  actualizarEstadisticas();
  elementos.btnIniciar.disabled = modo === 'prioritario' || modo === 'prioritarioV2'
    ? bancoPreguntasPrioritario.length === 0
    : modo === 'normal'
      ? bancoPreguntasNormal.length === 0
      : bancoPreguntasPrioritario.length === 0 || bancoPreguntasNormal.length === 0;
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
// NormalizaciÃ³n / validaciÃ³n
// -------------------------
function normalizarPregunta(p) {
  const pregunta = p.pregunta || p.question || '';
  const preguntaNormalizada = pregunta.toString().trim();
  const opciones = {
    opcion_a: p.opcion_a || p.opcionA || '',
    opcion_b: p.opcion_b || p.opcionB || '',
    opcion_c: p.opcion_c || p.opcionC || '',
    opcion_d: p.opcion_d || p.opcionD || '',
    opcion_e: p.opcion_e || p.opcionE || ''
  };

  const respuestaCorrecta = (p.respuesta_correcta || p.answer || '').toString().toUpperCase().trim();
  const preguntaNormalizadaObjeto = {
    modulo: p.modulo || p.module || 'General',
    tema: p.tema || 'General',
    pregunta: preguntaNormalizada,
    ...opciones,
    respuesta_correcta: respuestaCorrecta
  };

  const normalizada = {
    id: p.id ? Number(p.id) : crearIdTemporal(preguntaNormalizadaObjeto),
    modulo: p.modulo || p.module || 'General',
    semana: p.semana || '',
    tema: p.tema || 'General',
    subtema: p.subtema || '',
    nivel: p.nivel || '',
    tipo_pregunta: p.tipo_pregunta || '',
    pregunta: preguntaNormalizada,
    ...opciones,
    respuesta_correcta: respuestaCorrecta,
    respuesta_texto: p.respuesta_texto || p.answer_text || '',
    explicacion: p.explicacion || p.explicacion || '',
    probabilidad_salida: p.probabilidad_salida || p.probabilidad || '',
    prioridad: p.prioridad || '',
    origen_refuerzo: p.origen_refuerzo || ''
  };

  return { ...normalizada, clave: crearClavePregunta(normalizada) };
}

function crearIdTemporal(p) {
  const texto = `${p.modulo || ''}-${p.tema || ''}-${p.pregunta || ''}-${p.opcion_a || ''}-${p.opcion_b || ''}-${p.opcion_c || ''}-${p.opcion_d || ''}-${p.opcion_e || ''}`;
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = ((hash << 5) - hash) + texto.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function crearClavePregunta(p) {
  return [
    p.modulo || 'General',
    p.tema || 'General',
    p.subtema || '',
    p.pregunta || '',
    p.opcion_a || '',
    p.opcion_b || '',
    p.opcion_c || '',
    p.opcion_d || '',
    p.opcion_e || '',
    p.respuesta_correcta || ''
  ]
    .map(val => String(val || '').trim().toLowerCase())
    .join('||');
}

function dedupePreguntas(preguntas) {
  const vistos = new Set();
  return preguntas.filter(p => {
    const claveTexto = `txt:${p.clave}`;
    const claveId = p.id != null && !Number.isNaN(p.id) ? `id:${p.id}` : null;
    if (vistos.has(claveTexto)) return false;
    if (claveId && vistos.has(claveId)) return false;
    vistos.add(claveTexto);
    if (claveId) vistos.add(claveId);
    return true;
  });
}

function prioridadValor(prioridad) {
  if (!prioridad) return 0;
  const valor = String(prioridad).trim().toLowerCase();
  if (valor === 'alta') return 3;
  if (valor === 'media' || valor === 'medio') return 2;
  if (valor === 'baja') return 1;
  return 0;
}

function ordenarBancoPrioritario(banco) {
  return [...banco].sort((a, b) => {
    const probA = Number(a.probabilidad_salida) || 0;
    const probB = Number(b.probabilidad_salida) || 0;
    if (probB !== probA) return probB - probA;
    const prioA = prioridadValor(a.prioridad);
    const prioB = prioridadValor(b.prioridad);
    if (prioB !== prioA) return prioB - prioA;
    const modA = String(a.modulo || '').localeCompare(String(b.modulo || ''));
    if (modA !== 0) return modA;
    return String(a.tema || '').localeCompare(String(b.tema || ''));
  });
}

function filtrarDuplicadosEnLista(preguntas) {
  const vistos = new Set();
  return preguntas.filter(p => {
    const clave = `id:${p.id}`;
    const clave2 = `txt:${p.clave}`;
    if (vistos.has(clave) || vistos.has(clave2)) return false;
    vistos.add(clave);
    vistos.add(clave2);
    return true;
  });
}

function validarPregunta(p) {
  const tieneOpcionesMinimas = p.opcion_a && p.opcion_b && p.opcion_c && p.opcion_d && p.opcion_e;
  const tieneRespuestaValida = p.respuesta_correcta && LETRAS.includes(p.respuesta_correcta);
  return p.pregunta && tieneOpcionesMinimas && tieneRespuestaValida;
}

// -------------------------
// SelecciÃ³n de preguntas
// -------------------------
function seleccionarPreguntas(cantidad, modoSeleccion, modoPractica) {
  modoSeleccion = modoSeleccion || 'balanceado';
  modoPractica = modoPractica || (elementos.modoPractica ? elementos.modoPractica.value : 'normal');

  if (modoPractica === 'prioritario' || modoPractica === 'prioritarioV2') {
    return seleccionarDesdeBanco(bancoPreguntasPrioritario, cantidad, modoSeleccion, modoPractica);
  }

  // Mixto 50/50 entre prioritario y normal
  const prioridadCount = Math.floor(cantidad / 2);
  const normalCount = cantidad - prioridadCount;

  const partePrioritario = seleccionarDesdeBanco(bancoPreguntasPrioritario, prioridadCount, modoSeleccion, modoPractica);
  const parteNormal = seleccionarDesdeBanco(bancoPreguntasNormal, normalCount, modoSeleccion, modoPractica);

  const clavesPrioritarias = new Set(partePrioritario.map(p => `txt:${p.clave}`));
  const normalFiltrado = parteNormal.filter(p => !clavesPrioritarias.has(`txt:${p.clave}`));

  let seleccionMixta = [...partePrioritario, ...normalFiltrado];

  if (seleccionMixta.length < cantidad) {
    const faltan = cantidad - seleccionMixta.length;
    const poolPrioritario = filtrarDuplicadosEnLista(bancoPreguntasPrioritario).filter(p => !seleccionMixta.some(x => x.clave === p.clave));
    const poolNormal = filtrarDuplicadosEnLista(bancoPreguntasNormal).filter(p => !seleccionMixta.some(x => x.clave === p.clave));
    const fillExtras = mezclar([...poolPrioritario, ...poolNormal]).slice(0, faltan);
    seleccionMixta = [...seleccionMixta, ...fillExtras];
  }

  return mezclar(seleccionMixta).slice(0, cantidad);
}

function seleccionarDesdeBanco(banco, cantidad, modoSeleccion, modoPractica) {
  modoSeleccion = modoSeleccion || 'balanceado';
  modoPractica = modoPractica || 'normal';

  const bancoUnico = filtrarDuplicadosEnLista(banco);
  const bancoOrdenado = modoPractica === 'prioritario' || modoPractica === 'prioritarioV2' ? ordenarBancoPrioritario(bancoUnico) : bancoUnico;
  const historial = new Set(obtenerHistorial(modoPractica));
  const sinUsar = bancoOrdenado.filter(p => {
    return !historial.has(`id:${p.id}`) && !historial.has(`txt:${p.clave}`);
  });

  let seleccion = [];
  const prioridadDirecta = modoPractica === 'prioritario' || modoPractica === 'prioritarioV2';

  if (prioridadDirecta) {
    const topPoolSize = Math.max(cantidad * 2, cantidad + 10);
    const topCandidatos = sinUsar.slice(0, topPoolSize);
    if (topCandidatos.length >= cantidad) {
      seleccion = modoSeleccion === 'balanceado'
        ? seleccionarBalanceado(topCandidatos, cantidad)
        : topCandidatos.slice(0, cantidad);
    } else {
      seleccion = topCandidatos.slice();
      const usados = bancoOrdenado.filter(p => {
        return (historial.has(`id:${p.id}`) || historial.has(`txt:${p.clave}`)) && !seleccion.some(s => s.id === p.id);
      });
      const faltan = cantidad - seleccion.length;
      seleccion = seleccion.concat(mezclar(usados).slice(0, faltan));
    }
  } else if (sinUsar.length >= cantidad) {
    seleccion = modoSeleccion === 'balanceado' ? seleccionarBalanceado(sinUsar, cantidad) : mezclar(sinUsar).slice(0, cantidad);
  } else {
    seleccion = sinUsar.slice();
    const usados = bancoOrdenado.filter(p => {
      return (historial.has(`id:${p.id}`) || historial.has(`txt:${p.clave}`)) && !seleccion.some(s => s.id === p.id);
    });
    const faltan = cantidad - seleccion.length;
    seleccion = seleccion.concat(mezclar(usados).slice(0, faltan));
  }

  return seleccion.slice(0, cantidad);
}

// Mantener las funciones originales de selecciÃ³n balanceada/agrupaciÃ³n
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
  const modoPractica = elementos.modoPractica ? elementos.modoPractica.value : 'normal';

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
    const confirmar = confirm(`Te faltan ${total - respondidas} preguntas por responder. Â¿Deseas terminar de todas formas?`);
    if (!confirmar) return;
  }

  resultadosActuales = examenActual.map(p => {
    const marcada = respuestasUsuario[p.id] || '';
    const correcta = p.respuesta_correcta;
    const estado = !marcada ? 'blanco' : marcada === correcta ? 'correcta' : 'incorrecta';
    return { ...p, marcada, correcta, estado };
  });

  // Guardar en historial segÃºn modo
  const modoPractica = elementos.modoPractica ? elementos.modoPractica.value : 'normal';
  const idsExamen = examenActual.map(p => p.id);
  const clavesExamen = examenActual.map(p => p.clave).filter(Boolean);
  guardarHistorial(modoPractica, idsExamen, clavesExamen);

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
          <span class="badge">RevisiÃ³n ${index + 1}</span>
          <span class="badge">${escaparHTML(r.estado.toUpperCase())}</span>
          <span class="badge">${escaparHTML(r.tema)}</span>
        </div>
        <div class="review-title">${escaparHTML(r.pregunta)}</div>
        <div class="review-info">
          <p><strong>Tu respuesta:</strong> ${escaparHTML(textoMarcada)}</p>
          <p><strong>Respuesta correcta:</strong> ${escaparHTML(textoCorrecta)}</p>
          ${r.respuesta_texto ? `<p><strong>Respuesta clave:</strong> ${escaparHTML(r.respuesta_texto)}</p>` : ''}
        </div>
        ${r.explicacion ? `<div class="explanation"><strong>ExplicaciÃ³n:</strong> ${escaparHTML(r.explicacion)}</div>` : ''}
      </article>
    `;
  }).join('');

  if (lista.length === 0) elementos.revision.innerHTML = `<div class="alert">No hay preguntas para mostrar en esta vista. Â¡Excelente trabajo!</div>`;
}

function cancelarExamen() {
  const confirmar = confirm('Â¿Seguro que deseas cancelar el examen actual?');
  if (!confirmar) return;
  examenActual = [];
  respuestasUsuario = {};
  elementos.examen.classList.add('hidden');
  elementos.inicio.classList.remove('hidden');
}

function reiniciarParaMismoModo() {
  // Genera otro examen con mismo modo
  const modoSeleccion = elementos.modoSeleccion.value;
  const modoPractica = elementos.modoPractica ? elementos.modoPractica.value : 'normal';
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
function obtenerHistorial(modoPractica = 'normal') {
  try {
    const key = STORAGE_KEYS[modoPractica] || STORAGE_KEYS.normal;
    const almacenado = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(almacenado)) return [];

    return almacenado.flatMap(entry => {
      if (typeof entry === 'number' && !Number.isNaN(entry)) return [`id:${entry}`];
      if (typeof entry === 'string') {
        const texto = entry.trim();
        if (/^id:\d+$/.test(texto) || texto.startsWith('txt:')) return [texto];
        if (/^\d+$/.test(texto)) return [`id:${texto}`];
      }
      return [];
    });
  } catch {
    return [];
  }
}

function guardarHistorial(modoPractica, ids, claves = []) {
  try {
    const key = STORAGE_KEYS[modoPractica] || STORAGE_KEYS.normal;
    const actuales = new Set(obtenerHistorial(modoPractica));
    ids.forEach(id => {
      if (id != null && !Number.isNaN(Number(id))) actuales.add(`id:${Number(id)}`);
    });
    claves.forEach(clave => {
      if (typeof clave === 'string' && clave.trim()) actuales.add(`txt:${clave.trim()}`);
    });
    localStorage.setItem(key, JSON.stringify([...actuales]));
  } catch (e) {}
}

function reiniciarHistorial() {
  const confirmar = confirm('Â¿Deseas borrar el historial del modo seleccionado? Esto permitirÃ¡ que preguntas repetidas vuelvan a aparecer.');
  if (!confirmar) return;
  const modoPractica = elementos.modoPractica ? elementos.modoPractica.value : 'normal';
  const key = STORAGE_KEYS[modoPractica] || STORAGE_KEYS.normal;
  localStorage.removeItem(key);
  actualizarEstadisticas();
}

function actualizarEstadisticas() {
  const modo = elementos.modoPractica ? elementos.modoPractica.value : 'normal';
  const usadas = obtenerHistorial(modo) || [];
  const idsUsadas = new Set(usadas.filter(entry => entry.startsWith('id:')).map(entry => Number(entry.slice(3))).filter(n => !Number.isNaN(n)));
  const clavesUsadas = new Set(usadas.filter(entry => entry.startsWith('txt:')).map(entry => entry.slice(4)));

  let total = bancoPreguntas.length;
  let disponibles = bancoPreguntas.filter(p => !idsUsadas.has(Number(p.id)) && !clavesUsadas.has(p.clave)).length;

  if (modo === 'mixto') {
    total = bancoPreguntasPrioritario.length + bancoPreguntasNormal.length;
    disponibles = [...bancoPreguntasPrioritario, ...bancoPreguntasNormal].filter(p => !idsUsadas.has(Number(p.id)) && !clavesUsadas.has(p.clave)).length;
  }

  if (modo === 'prioritario' || modo === 'prioritarioV2') {
    total = bancoPreguntasPrioritario.length;
    disponibles = bancoPreguntasPrioritario.filter(p => !idsUsadas.has(Number(p.id)) && !clavesUsadas.has(p.clave)).length;
  }

  const usadasCount = usedHistorialCount(usadas);
  elementos.totalPreguntas.textContent = total;
  elementos.preguntasUsadas.textContent = usadasCount;
  elementos.preguntasDisponibles.textContent = disponibles;
}

function usedHistorialCount(usadas) {
  const idsUsadas = new Set(usadas.filter(entry => entry.startsWith('id:')));
  const clavesUsadas = new Set(usadas.filter(entry => entry.startsWith('txt:')));
  return idsUsadas.size + clavesUsadas.size;
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


