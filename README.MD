# Simulador de Examen SENATI - Ingeniería de Software con IA

Este proyecto es una aplicación web local creada para practicar exámenes tipo marcar, enfocada en la carrera de **Ingeniería de Software con Inteligencia Artificial en SENATI**.

El simulador permite cargar bancos de preguntas en formato JSON o CSV, seleccionar preguntas de manera aleatoria y balanceada, responder un examen, revisar los resultados y practicar nuevamente intentando evitar preguntas repetidas.

---

## Objetivo del proyecto

El objetivo principal de esta web es servir como una herramienta de estudio para preparar evaluaciones de SENATI, especialmente en temas relacionados con:

* Desarrollo de aplicaciones móviles.
* Soluciones IoT.
* Fullstack Developer Software.
* Machine Learning e Inteligencia Artificial.
* Google Colab, TensorFlow, Keras y Teachable Machine.
* Git, GitHub, Node.js, React, API REST y Docker.
* Arduino, Raspberry Pi, sensores, actuadores y protocolos IoT.

---

## Estructura del proyecto

La estructura recomendada del proyecto es la siguiente:

```text
ESTUDIO-EXAMEN/
│
├── index.html
├── style.css
├── script.js
│
├── data/
│   ├── banco_preguntas_examen_prioritario.json
│   ├── banco_preguntas_senati_3000.json
│   ├── banco_preguntas_examen_prioritario.csv
│   └── banco_preguntas_examen.csv
│
└── README.md
```

---

## Archivos principales

### `index.html`

Contiene la estructura principal de la página web. Incluye las secciones de:

* Pantalla de inicio.
* Configuración del examen.
* Selección del modo de práctica.
* Examen en curso.
* Resultados finales.
* Revisión de respuestas.

---

### `style.css`

Contiene el diseño visual de la aplicación. El estilo está orientado a una plataforma formal de evaluación académica, usando principalmente colores:

* Azul.
* Blanco.
* Tonos suaves.
* Tarjetas limpias.
* Diseño responsivo para PC y celular.

---

### `script.js`

Contiene toda la lógica del simulador:

* Carga de bancos de preguntas.
* Lectura de archivos JSON.
* Soporte de CSV como respaldo.
* Selección de preguntas.
* Balanceo por módulo, tema y subtema.
* Control de respuestas.
* Cálculo de puntaje.
* Revisión final.
* Historial de preguntas usadas con `localStorage`.

---

## Bancos de preguntas

El proyecto trabaja principalmente con dos bancos:

### 1. Banco prioritario

Archivo:

```text
data/banco_preguntas_examen_prioritario.json
```

Este banco contiene preguntas filtradas con mayor probabilidad de aparecer en el examen. Está recomendado para practicar en los últimos días antes de la evaluación.

---

### 2. Banco amplio

Archivo:

```text
data/banco_preguntas_senati_3000.json
```

Este banco contiene una mayor cantidad de preguntas y sirve para repasar todos los temas de forma más amplia.

---

## Modos de práctica

El simulador cuenta con tres modos principales:

---

### 1. Simulacro mixto

Este es el modo recomendado por defecto.

Usa aproximadamente:

* 70% de preguntas del banco prioritario.
* 30% de preguntas del banco amplio.

Ejemplo para un examen de 60 preguntas:

```text
42 preguntas del banco prioritario
18 preguntas del banco amplio
```

Este modo es ideal para practicar durante la semana, porque combina preguntas con mayor probabilidad de salir y preguntas de repaso general.

---

### 2. Simulacro probable

Este modo usa solamente el banco prioritario.

Está recomendado para los últimos días antes del examen, ya que se enfoca en preguntas con mayor posibilidad de aparecer en la evaluación.

---

### 3. Repaso completo

Este modo usa el banco amplio.

Sirve para estudiar todos los temas posibles, incluso aquellos que tienen menor probabilidad de salir, pero que pertenecen al contenido oficial de la carrera.

---

## Funcionamiento del simulador

El proceso general es el siguiente:

1. El usuario abre la web.
2. Selecciona el modo de práctica.
3. Selecciona la cantidad de preguntas.
4. Inicia el examen.
5. El sistema carga el banco correspondiente.
6. Se seleccionan preguntas variadas por módulo, tema y subtema.
7. El usuario responde las preguntas.
8. Al finalizar, el sistema muestra:

   * Puntaje final.
   * Porcentaje obtenido.
   * Cantidad de respuestas correctas.
   * Cantidad de respuestas incorrectas.
   * Preguntas sin responder.
   * Respuesta marcada.
   * Respuesta correcta.
   * Explicación, si existe en el banco.

---

## Historial de preguntas usadas

El simulador usa `localStorage` para recordar preguntas usadas y evitar repetirlas de inmediato en nuevos exámenes.

Cada modo tiene su propio historial:

```text
historial_senati_mixto
historial_senati_probable
historial_senati_completo
```

Esto permite que el sistema controle de forma separada las preguntas usadas en cada tipo de práctica.

Si ya no hay suficientes preguntas nuevas, el sistema puede reutilizar algunas preguntas, pero solo cuando sea necesario.

---

## Botón “Reiniciar historial”

El botón **Reiniciar historial** borra las preguntas usadas del modo seleccionado actualmente.

Esto sirve si el estudiante quiere volver a practicar desde cero o repetir preguntas para reforzar memoria.

---

## Recomendación de uso para estudiar

Para prepararse mejor para el examen, se recomienda usar el simulador de esta forma:

### Durante la semana

Usar:

```text
Simulacro mixto
```

Este modo combina alta probabilidad y variedad.

---

### Últimos días antes del examen

Usar:

```text
Simulacro probable
```

Este modo se enfoca en preguntas prioritarias.

---

### Para reforzar temas débiles

Usar:

```text
Repaso completo
```

Este modo ayuda a cubrir todos los temas del banco amplio.

---

## Configuración recomendada

Para una práctica equilibrada:

```text
Modo: Simulacro mixto
Cantidad: 60 preguntas
Selección: balanceada por módulo y tema
Objetivo mínimo: 85%
```

Un puntaje recomendado sería:

```text
51/60 preguntas correctas o más
```

---

## Cómo ejecutar el proyecto

### Opción recomendada: Visual Studio Code con Live Server

1. Abrir la carpeta del proyecto en Visual Studio Code.
2. Instalar la extensión **Live Server**.
3. Hacer clic derecho sobre `index.html`.
4. Seleccionar **Open with Live Server**.
5. El navegador abrirá el simulador correctamente.

---

### Opción alternativa: servidor local con Python

Desde la carpeta del proyecto, ejecutar:

```bash
python -m http.server 8000
```

Luego abrir en el navegador:

```text
http://localhost:8000
```

---

## Importante

No se recomienda abrir directamente el archivo `index.html` con doble clic si el navegador bloquea la carga de archivos locales.

Debido a que el simulador usa `fetch()` para cargar los bancos de preguntas, es mejor ejecutarlo con Live Server o con un servidor local.

---

## Formato esperado de las preguntas

Cada pregunta debe tener, como mínimo, los siguientes campos:

```text
id
modulo
tema
subtema
pregunta
opcion_a
opcion_b
opcion_c
opcion_d
opcion_e
respuesta_correcta
explicacion
```

La columna o propiedad `respuesta_correcta` debe contener una letra:

```text
A, B, C, D o E
```

También puede incluir campos adicionales como:

```text
semana
nivel
tipo_pregunta
respuesta_texto
probabilidad_salida
prioridad
origen_refuerzo
tags
```

---

## Recomendaciones para mejorar el banco

Para que el simulador sea más preciso, se recomienda seguir agregando preguntas de:

* Evaluaciones anteriores.
* Capturas de tests reales.
* Preguntas de clase.
* Videos del curso.
* Material oficial de SENATI.
* Preguntas técnicas de documentación oficial.

Mientras más preguntas reales o similares se agreguen, mayor será la probabilidad de que el simulador se acerque al examen.

---

## Limitaciones

Este simulador no garantiza que las preguntas sean exactamente iguales a las del examen oficial.

Sin embargo, ayuda a practicar conceptos, reconocer patrones de preguntas y reforzar temas con alta probabilidad de evaluación.

La precisión mejora si el banco de preguntas se actualiza con preguntas reales o capturas de exámenes anteriores.

---

## Tecnologías usadas

* HTML5.
* CSS3.
* JavaScript.
* JSON.
* CSV.
* LocalStorage.
* Live Server para ejecución local.

---

## Estado del proyecto

Proyecto en desarrollo local para preparación académica.

Funciones principales implementadas:

* Selección de banco de preguntas.
* Simulacro mixto.
* Simulacro probable.
* Repaso completo.
* Examen de opción múltiple.
* Revisión final.
* Historial de preguntas usadas.
* Diseño formal y responsivo.

---

## Autor

Proyecto de práctica académica para preparación de examen en SENATI.

Carrera:

```text
Ingeniería de Software con Inteligencia Artificial
```
