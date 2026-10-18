# Auditoría exploratoria con Playwright CLI

> Documento histórico de una revisión con un alcance más amplio. Después se acordó evaluar únicamente escritorio con respuestas reales de los ejecutables. Los casos de móvil y las respuestas artificiales de este documento quedan fuera del diagnóstico solicitado. El informe vigente está en [Diagnóstico de representación con datos reales](../escritorio-real/INFORME.md).

Fecha: 18 de octubre de 2026. Rama: `fix/monitorizacion-fiable`. Código auditado: `38a8961`.

Se utilizó Playwright CLI con Microsoft Edge contra `http://127.0.0.1:4200`, en escritorio de 1366 × 768 y móvil de 390 × 844. Se recorrieron grafo, catálogo y mapa, sus controles, búsquedas, paginación, descarga y formularios. Las respuestas lentas, inválidas, los errores y el acceso protegido se probaron mediante interceptaciones de red de Playwright en páginas separadas.

El recorrido real comparó el catálogo antes y después: **18 registros, sin cambios**. Las escrituras del recorrido real estaban interceptadas; las de los escenarios adversos recibieron respuestas simuladas. No se modificó el código funcional, la base de datos ni los procesos del usuario.

## Hallazgos

| ID | Prioridad | Problema | Evidencia |
|---|---|---|---|
| A01 | Alta | Un estado mal formado de un nodo invalida la ronda completa de monitorización. | Un controlador con `Data.balancerList: [null]` deja `0 / 0 responden`, aunque otros dos procesos responden correctamente. |
| A02 | Alta | Un nodo pendiente de responder se presenta como si no respondiera. | Con tres nodos sanos y 1,2 s de retraso en uno de ellos, el contador pasa de 3/3 a 2/3 y vuelve a 3/3 sin errores ni timeout. |
| A03 | Media | Iconos y nombres del grafo se superponen. | En la captura de escritorio se midieron 9 pares de iconos con rectángulos intersectados; en móvil, 26. «Ajustar vista» no lo resuelve. |
| A04 | Media | Un filtro de grupo puede quedar activo sin existir ya en el selector. | Al caer los tres nodos de Grupo 1 pasan a Sin grupo; el filtro interno sigue en Grupo 1 y oculta todos los nodos. |
| A05 | Media | El catálogo no ofrece recuperación directa de un fallo temporal. | Tras un 503 inicial no hay reintento automático ni botón para reintentar. Volver a la búsqueda vacía tampoco emite otra petición. |
| A06 | Media | El catálogo pide una clave de acceso que no se puede introducir en esa pantalla. | Entrada directa a `/lista` con 401: mensaje «Introduce la clave de acceso», cero campos de contraseña y cero botones Conectar. |
| A07 | Media | El refresco del mapa elimina el foco de teclado del marcador. | Tras enfocar un marcador y refrescar, `document.activeElement` cambia de `IMG[role=button]` a `BODY`. |
| A08 | Media | Una URL desconocida deja la aplicación sin contenido. | `/ruta-que-no-existe` devuelve el HTML con HTTP 200, Angular registra NG04002 y queda una pantalla vacía, sin explicación ni enlace de recuperación. |
| A09 | Baja | El detalle oculta el fallo al guardar la fecha de consulta. | DEBUG correcto y PATCH de consulta con 503: el detalle muestra el estado pero no avisa del fallo de persistencia. |
| A10 | Baja | Faltan nombres y alternativas de acceso en varios controles. | Los 18 marcadores tienen nombre genérico «Marker», el cierre del formulario no tiene nombre accesible y el grafo no tiene nodos enfocables. |
| A11 | Baja | Los formularios repiten los errores y Enter no envía. | El mismo resumen de errores aparece al principio y debajo de URL. Enter en Nombre no emite la petición de guardado. |

Las prioridades valoran el impacto en una herramienta de monitorización: A01 y A02 pueden ocultar nodos sanos o producir una impresión incorrecta de disponibilidad. No son una clasificación de vulnerabilidades de seguridad.

### A01 — Aislar las respuestas mal formadas

Reproducción: servir tres fichas válidas, hacer que un controlador responda con `balancerList: [null]` y retrasar 150 ms las respuestas válidas restantes. Abrir el grafo.

Resultado: mensaje `Cannot read properties of null (reading 'url')`, catálogo visible vacío y aviso «Datos anteriores» incluso en la primera carga. No hubo una excepción de página sin capturar: el error acaba en la recuperación global de la ronda.

Causa: `validDebug` comprueba que las listas sean arrays, pero no valida sus elementos. `buildTopology` accede a `p.url`; el error termina en el `catchError` de la ronda completa.

Ubicación: `frontend/starter/src/app/services/topology.ts:50`, `:97` y `frontend/starter/src/app/services/monitor.service.ts:45`.

Corrección propuesta: validar los elementos y las referencias, aislar el fallo en el nodo que devuelve el estado incorrecto y conservar la monitorización del resto.

Evidencia: escenario `respuesta_malformada_aislamiento` de [casos-adversos-resultados.json](casos-adversos-resultados.json) y [captura](respuesta-malformada.png).

### A02 — Diferenciar pendiente de no disponible

Reproducción: cargar tres nodos sanos. En la segunda ronda, retrasar 1200 ms el DEBUG del procesador; el timeout configurado es 3000 ms y la ronda se inicia cada 2000 ms.

Resultado: el procesador pasa temporalmente a `status: false, pending: true`, desaparece su última consulta del estado provisional y el contador baja a 2/3. Se obtuvieron 11 muestras de este estado, con muestreo de 100 ms. Después vuelve a 3/3 sin ningún fallo de petición.

Causa: cada ronda reconstruye todos los nodos con `status: false`; la vista y sus filtros no distinguen ese estado provisional de una consulta fallida.

Ubicación: `frontend/starter/src/app/services/monitor.service.ts:39`, `frontend/starter/src/app/modules/admin/monitor-view.ts:20` y `frontend/starter/src/app/modules/admin/monitor-toolbar.component.ts:48`.

Corrección propuesta: conservar el último estado confirmado mientras se consulta, mostrar un indicador de pendiente y marcar el fallo únicamente al recibir un error, una respuesta inválida o un timeout.

Evidencia: `nodo_lento_sin_caida` en [casos-adversos-resultados.json](casos-adversos-resultados.json).

### A03 — Dar espacio real a los nodos del grafo

Reproducción: abrir los 18 registros reales en escritorio y en móvil. Pulsar «Ajustar vista» en móvil.

Resultado: iconos y nombres superpuestos. En móvil el lienzo disponible mide 290 px, pero el cálculo de posiciones utiliza un ancho mínimo de 500 px y símbolos de 60 px. ECharts ajusta las posiciones al contenedor sin resolver las colisiones. En escritorio también se comprimen filas verticalmente según los grupos presentes.

Las mediciones cuentan intersecciones entre rectángulos de iconos; no incluyen el espacio adicional de sus nombres. Son una medida de esta captura concreta, no un resultado fijo para cualquier estado de los ejecutables.

Ubicación: `frontend/starter/src/app/modules/admin/grafo/grafo.component.ts:33`, `:40` y `:50`.

Corrección propuesta: calcular distancias según el tamaño final de símbolos y etiquetas, reservar altura por grupo y definir una adaptación explícita a pantallas estrechas. Ajustar vista debe encuadrar una distribución legible.

Evidencia: [escritorio](grafo-escritorio.png), [móvil](grafo-movil.png) y `collisions` de [recorrido-real-resultados.json](recorrido-real-resultados.json).

### A04 — Mantener coherentes los grupos y el filtro

Reproducción: seleccionar Grupo 1 y hacer que todos sus DEBUG fallen en la siguiente consulta.

Resultado: los nodos pasan a Sin grupo. El selector solo ofrece Todos y Sin grupo, su valor DOM queda vacío, pero `filters.group` conserva Grupo 1. La vista muestra «No hay nodos visibles» hasta que el usuario selecciona otro valor.

Ubicación: agrupación en `frontend/starter/src/app/services/topology.ts`, filtro en `frontend/starter/src/app/modules/admin/monitor-view.ts:20` y opciones en `monitor-toolbar.component.ts:47`.

Corrección propuesta: estabilizar la pertenencia al grupo con información confirmada previamente y reconciliar un filtro cuyo valor haya desaparecido.

Evidencia: `filtro_grupo_tras_caida` en [casos-adversos-resultados.json](casos-adversos-resultados.json).

### A05 — Poder reintentar la carga del catálogo

Reproducción: responder 503 a la primera consulta del catálogo y restaurar el servicio. Esperar y volver a dejar la búsqueda vacía.

Resultado: sigue vacío, con una única petición y sin botón de reintento. Cambiar la búsqueda a otro texto sí permite recuperar las filas. Además del error aparece el mensaje «No hay nodos que coincidan con la búsqueda», aunque el problema es que no se pudieron cargar.

Ubicación: `frontend/starter/src/app/modules/admin/lista/lista.component.ts:41` y `lista.component.html`.

Corrección propuesta: añadir una acción visible de reintento independiente del texto de búsqueda y distinguir el estado vacío del estado de error.

Evidencia: `catalogo_recuperacion_sin_recargar` en [casos-adversos-resultados.json](casos-adversos-resultados.json).

### A06 — Ofrecer acceso desde cualquier entrada protegida

Reproducción: sesión sin clave, API con 401 y entrada directa a `/lista`.

Resultado: se pide introducir una clave, pero el formulario está únicamente en la barra de monitorización de grafo/mapa. El usuario debe descubrir que tiene que cambiar de pantalla.

Corrección propuesta: ofrecer el mismo acceso desde catálogo o un control común a toda la aplicación, con regreso a la pantalla original después de conectarse.

Evidencia: `acceso_protegido_entrada_directa_catalogo` en [casos-adversos-resultados.json](casos-adversos-resultados.json).

### A07 — Conservar el foco en el mapa

Reproducción: enfocar un marcador con teclado y esperar el siguiente refresco. En el escenario se usó un intervalo de 800 ms para hacerlo visible rápidamente.

Resultado: el foco pasa al cuerpo de la página. El código retira todos los marcadores y los crea de nuevo en cada renderizado.

Ubicación: `frontend/starter/src/app/modules/admin/mapa/mapa.component.ts:31`.

Corrección propuesta: actualizar marcadores existentes por identificador y retirar únicamente los eliminados; conservar el foco cuando corresponda.

Evidencia: `marcador_teclado_pierde_foco_al_refrescar` en [casos-adversos-resultados.json](casos-adversos-resultados.json).

### A08 — Resolver las rutas inexistentes

Reproducción: abrir `/ruta-que-no-existe` directamente.

Resultado: error Angular `NG04002: Cannot match any routes` en consola, URL final `/` y cuerpo sin texto tras esperar la navegación. No aparece una pantalla de error ni un acceso al grafo.

Ubicación: `frontend/starter/src/app/app.routes.ts`, sin ruta comodín.

Corrección propuesta: añadir una pantalla de ruta no encontrada o una redirección controlada.

Evidencia: `ruta_inexistente_consola` en [casos-adversos-resultados.json](casos-adversos-resultados.json) y [captura](ruta-inexistente.png).

### A09 — Informar del fallo al persistir la fecha

Reproducción: DEBUG válido y PATCH `/api/nodo/1/consulta` con 503.

Resultado: el detalle sigue funcionando y no muestra ninguna advertencia de que la fecha no se ha guardado. El error se convierte en `null` y el indicador `recorded` se establece antes de confirmar el guardado, de modo que esa instancia del detalle no tiene un mecanismo de reintento.

Ubicación: `frontend/starter/src/app/modules/admin/dialogs/dialog.component.ts:34`.

Corrección propuesta: distinguir consulta correcta de fecha persistida, avisar del segundo fallo y confirmar `recorded` únicamente después de una respuesta correcta.

Evidencia: `detalle_fecha_fallo_guardado` en [casos-adversos-resultados.json](casos-adversos-resultados.json).

### A10 — Completar los nombres accesibles

Resultado: los marcadores del mapa son botones de teclado con `alt="Marker"`, sin nombre del nodo en `title` o `aria-label`. El cierre de los formularios de alta y edición solo contiene un SVG sin nombre accesible. El grafo usa canvas y no ofrece elementos de nodo enfocables; existe acceso alternativo al detalle desde catálogo, pero no navegación directa por la topología con teclado.

Corrección propuesta: asignar nombre de nodo y estado a cada marcador, nombrar los cierres y ofrecer una alternativa navegable a las relaciones del canvas.

Evidencia: `mapa_real_movil_y_teclado`, `grafo_movil` y `catalogo_movil_y_formulario` en [recorrido-real-resultados.json](recorrido-real-resultados.json), y `formulario_validacion_y_teclado` en [casos-adversos-resultados.json](casos-adversos-resultados.json).

### A11 — Ordenar la validación y permitir envío con Enter

Reproducción: abrir Añadir nodo, pulsar Añadir con campos vacíos y recibir los errores de validación. Después rellenar los campos y pulsar Enter en Nombre.

Resultado: el resumen aparece dos veces, una de ellas bajo URL aunque los errores afecten a otros campos. Enter no guarda porque la edición está implementada con un botón de clic fuera de un formulario con envío.

Ubicación: `frontend/starter/src/app/modules/admin/dialogs/anadirNodo.html:9`, `:57` y `:97`. La plantilla de edición repite el mismo patrón.

Corrección propuesta: un único resumen, errores junto al campo correspondiente y formulario con envío por botón o teclado.

La respuesta de validación de este escenario fue simulada; se comprobó el comportamiento del frontend sin enviar altas a XAMPP.

## Comprobaciones que funcionaron

- El frontend real sirve grafo, catálogo y mapa; el proxy devuelve el catálogo.
- Se muestran los 18 registros. Las cantidades de procesos que responden variaron durante el recorrido; una fotografía de ese contador no certifica su disponibilidad permanente.
- Filtro por Procesador: 10 nodos; combinación con Responden: 3 en ese momento.
- Desactivar conexiones reduce las líneas a cero y volver a activarlas las restaura según el estado recibido.
- Paginación: 10 registros en la primera página y 8 en la segunda.
- Una búsqueda sin coincidencias muestra el vacío; borrarla restaura la primera página.
- Descargar genera `listaNodos.json` sin error de descarga.
- Cambios repetidos entre grafo, catálogo y mapa no produjeron excepciones de página en el recorrido real.
- Cancelar borrado y cerrar edición no emiten escrituras en el escenario aislado.
- Las imágenes de nodos y las teselas presentes en la captura del mapa se cargaron; no se detectaron imágenes fallidas en ese momento.

Los 502 de consultas DEBUG a ejecutables no disponibles se contabilizaron como respuestas de esos servicios, no como defectos nuevos del frontend. El duplicado P8/P2 continúa siendo un problema conocido de los datos y aparece como aviso.

## Repetición y artefactos

Con el frontend y la API arrancados:

```powershell
playwright-cli -s=auditoria open about:blank --browser=msedge
playwright-cli -s=auditoria run-code --filename=diagnostico/auditoria-playwright/recorrido-real.js
playwright-cli -s=auditoria run-code --filename=diagnostico/auditoria-playwright/casos-adversos.js
playwright-cli -s=auditoria close
```

Los scripts están fijados a `http://127.0.0.1:4200` y utilizan la API de depuración de Angular para medir estados internos; requieren el servidor de desarrollo. Las capturas se sobrescriben al repetirlos. Los JSON adjuntos conservan los resultados de esta ejecución. Esta auditoría no comprueba entrega real de mensajes ni TTN, rendimiento bajo carga o una instalación de producción.

Orden recomendado: A01 y A02 primero; después A03 y A04; continuar con recuperación, acceso, navegación y teclado. A09 y A11 son mejoras menores de feedback y edición.
