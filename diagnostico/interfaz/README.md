# Composición y navegación de la interfaz de escritorio

La interfaz se ha ajustado al espacio de la ventana. Durante esta revisión visual se conservó la lógica de consulta, disponibilidad y topología. Posteriormente, el 20 de octubre de 2026, se corrigió el refresco automático publicando rondas completas; véase [REFRESCO.md](../escritorio-real/REFRESCO.md).

## Ubicación histórica del estado pendiente

Antes de corregir el refresco, el `status: false` que se comentó estaba en `frontend/starter/src/app/services/monitor.service.ts`, al crear la lista inicial de cada ronda:

```typescript
return { nodo, endpoint, datos: null, status: false, pending: true };
```

Esa lista provisional se ha eliminado: ahora se conserva la ronda anterior hasta completar la siguiente. La investigación sigue disponible en [REFRESCO.md](../escritorio-real/REFRESCO.md).

## Cambios

- Cabecera de dos filas, de 83 px en las tres resoluciones verificadas. Los avisos y el acceso protegido se despliegan sobre el contenido, sin quitar altura al lienzo.
- Distribución que ocupa el espacio restante de la ventana, con una barra lateral de navegación y un marco común para grafo y mapa.
- Grafo encuadrado por defecto: se ajustan conjuntamente posiciones y tamaño de símbolos, con espacio reservado para los nombres. Ya no necesita una página más alta para mostrar sus 18 nodos.
- Navegación del grafo mediante arrastre, rueda, botones Acercar/Alejar y Centrar. El estado de zoom y posición se conserva después de consultar los procesos. Centrar y Ajustar vista recuperan el encuadre completo.
- Iconos del mapa de 48 × 48 px en lugar de 32 × 32. Las etiquetas con nombre y grupo se muestran al pasar el ratón y el clic sigue abriendo el detalle.
- Modal de nodo con nombre destacado, indicador de respuesta, información organizada, contadores, tablas y configuración desplegable. El encabezado y el pie permanecen visibles; una sola zona central permite recorrer el contenido con la rueda.
- Se elimina para este modal el relleno duplicado de la plantilla y el límite independiente de altura del contenido de Angular Material. Los formularios de alta y edición conservan su presentación y funcionamiento independientes.

No se han añadido dependencias ni fuentes externas. Se conservan los iconos originales de los roles.

## Verificación

Playwright CLI con Edge, las respuestas reales de los ejecutables y el catálogo existente. Las escrituras de fechas que intenta hacer el detalle se bloquearon antes de salir del navegador; no se sustituyeron respuestas DEBUG.

18 comprobaciones correctas:

- Todos los nodos, sin solapamientos ni recortes, en 1280 × 720, 1366 × 768 y 1920 × 1080.
- Sin desplazamiento vertical de la página para recorrer el grafo; lienzo de 611, 659 y 971 px de altura respectivamente.
- Botones de zoom y rueda correctos.
- Arrastre real de 90 px y conservación de la posición y zoom después del refresco.
- Centrado y apertura con ratón del nodo inferior P13, sin desplazar la página.
- Filtros y desplegables de cabecera correctos.
- Iconos del mapa de 48 px, etiquetas y controles de zoom correctos.
- Modal de controlador completo y sin desbordamiento horizontal de tablas en 1366 × 768 y 1280 × 720.
- Configuración desplegada y accesible con la rueda, con el pie y el cierre visibles.
- Modal de procesador y de nodo sin respuesta correctos.
- Catálogo: búsqueda y paginación correctas.

No hubo excepciones de página y el catálogo quedó idéntico antes y después. Los resultados están en [verificacion-resultados.json](verificacion-resultados.json); el recorrido se repite con [verificar.js](verificar.js):

```powershell
playwright-cli -s=interfaz open about:blank --browser=msedge
playwright-cli -s=interfaz run-code --filename=diagnostico/interfaz/verificar.js
playwright-cli -s=interfaz close
```

La regresión existente de navegador terminó con 65 comprobaciones correctas, utilizando su entorno controlado. `npm test` terminó con 11 pruebas correctas. La compilación de producción terminó correctamente; se mantienen los avisos existentes de Leaflet/CommonJS y tamaño de Fuse.

Capturas de esta revisión: [grafo](grafo-inicial.png), [mapa](mapa-inicial.png), [detalle](detalle-inicial.png), [configuración desplazada](modal-configuracion.png).

## Mapa único y centrado, 22 de octubre de 2026

Se desactiva la repetición horizontal de las teselas (`noWrap`) y se limita el arrastre al mundo de Web Mercator. El encuadre inicial contiene la vista mundial entre 60° S y 80° N dentro del ancho y la altura reales del panel, con 32 px de margen. Así los nodos del catálogo no quedan recortados por arriba en ventanas bajas. El espacio lateral usa el mismo color del océano y no añade copias del mundo. «Ajustar vista» encuadra los nodos visibles con margen; el refresco conserva la posición y el zoom elegidos.

La gestión del tamaño se concentra en `ResizeObserver`, con el evento de fin del movimiento aplazado hasta terminar el ajuste. Evita que Leaflet recoloque el mapa a partir de dimensiones intermedias. Cuando se cambia el tamaño desde la vista general se conserva el encuadre general; si el usuario ha acercado el mapa, se conserva su centro dentro de los límites.

Compilación de desarrollo correcta y quince comprobaciones de Playwright CLI correctas: inicio sin pulsar «Ajustar vista», seis ventanas de escritorio (incluidas 1920 × 900, 1816 × 840 y 1100 × 650), panel de 1100 × 470 dentro de una ventana de 1920 × 1080, ajuste manual, arrastre en ambos sentidos, zoom, límites y refresco. Los 18 marcadores se mantienen completos en las comprobaciones de encuadre. Sin errores de página. Se usaron respuestas controladas y las coordenadas de la exportación previa; no se accedió a XAMPP ni a ejecutables reales.

Recorrido: [mapa-limites.js](mapa-limites.js). Resultados: [mapa-limites-resultados.json](mapa-limites-resultados.json). Capturas con datos de prueba: [inicio](mapa-inicio-centrado.png), [ventana baja](mapa-ventana-baja.png), [panel reducido](mapa-panel-reducido.png) y [ajuste manual](mapa-unico.png).

## Pinza del panel táctil y catálogo, 22 de octubre de 2026

La directiva compartida `monitorCanvasNavigation` escucha `wheel` con captura y `passive: false` únicamente en los lienzos. Cancela la acción predeterminada de zoom/desplazamiento de la página y deja llegar el evento a ECharts y Leaflet. El gesto de pinza del panel táctil se entrega como Ctrl+rueda; sigue cambiando el zoom del dibujo incluso al evitar el zoom de la página. El listener se libera al salir de la vista. `touch-action` y `overscroll-behavior` contienen también los gestos en el lienzo.

El catálogo comparte marco, colores, jerarquía y controles compactos con grafo y mapa. La cabecera incorpora título, contador de fichas, búsqueda y acciones. La tabla coloca nombre y visibilidad al principio, distingue direcciones y coordenadas y sustituye los botones circulares de colores por acciones uniformes. Cabecera de tabla y paginación permanecen visibles mientras se desplazan las filas. Se conservan los formularios y operaciones existentes.

Doce comprobaciones correctas con Playwright CLI y Edge contra la API y Angular reales en 8080/4200: catálogo en 1280 × 720, 1366 × 768 y 1920 × 900, búsqueda, paginación, apertura y cierre del alta sin guardar, rueda, pinza mediante Ctrl+rueda y límite de zoom en ambas vistas. Cambia el zoom del dibujo; DPR, escala del viewport, dimensiones de cabecera y desplazamiento de página permanecen iguales. No se probaron gestos físicos con hardware: se enviaron los eventos equivalentes desde Playwright. Sin errores de página y catálogo idéntico antes y después; las escrituras de fecha se bloquean antes de navegar.

Recorrido: [catalogo-y-gestos.js](catalogo-y-gestos.js). Resultados: [catalogo-y-gestos-resultados.json](catalogo-y-gestos-resultados.json). Capturas del catálogo real: [1366 × 768](catalogo-1366x768.png), [1280 × 720](catalogo-1280x720.png), [1920 × 900](catalogo-1920x900.png).

La compilación de desarrollo y la regresión completa `npm.cmd run test:browser` terminan correctamente: 67 comprobaciones con respuestas controladas, incluidas altas, edición, ocultación, eliminación confirmada, detalle y acceso protegido. No requieren escribir sobre el catálogo real.

## Formularios de alta y edición, 22 de octubre de 2026

Ambos formularios comparten `dialogs/node-editor.html` y sus estilos, con el marco, tipografía y botones del catálogo y del detalle. Los ocho campos se agrupan en identificación, conexión y representación. La cabecera y los botones de cancelar/guardar permanecen visibles y solo el contenido central se desplaza en ventanas bajas. Los errores del servidor se presentan una sola vez en un aviso. Se conservan los roles, sus iconos, los valores iniciales, la validación del servidor y las operaciones de alta/edición.

Compilación de desarrollo correcta. Once comprobaciones de aspecto e interacción correctas con Playwright CLI en 1366 × 768, 1280 × 720 y 1100 × 600: campos sin desbordamiento, edición precargada, cabecera y botones fijos, cancelación sin guardar, cinco roles con sus iconos y error visible. Nueve regresiones del catálogo y detalle también correctas, incluidas altas y edición mediante los nuevos formularios. Todas utilizaron respuestas controladas; no se escribieron datos en XAMPP.

Recorrido: [formularios.js](formularios.js). Resultados: [aspecto](formularios-resultados.json) y [regresión](formularios-regresion-resultados.json). Capturas con datos de prueba: [añadir](formulario-anadir-1366x768.png), [editar](formulario-editar-1280x720.png), [error](formulario-error.png).

## Paginación, borrado y confirmaciones, 22 de octubre de 2026

El paginador del catálogo usa `MatPaginatorIntl` en español, incluidos los rangos y las etiquetas de navegación. La confirmación de borrado comparte los estilos del editor: ficha identificada, aviso sobre el ejecutable y botones diferenciados para cancelar y eliminar.

Las altas, edición, cambios de visibilidad y borrado muestran un aviso de éxito solo tras completarse la operación. Se cierra automáticamente a los 3,5 segundos o mediante «Cerrar». Al comenzar otra acción se descarta el anterior y los errores no generan avisos de éxito. Se sitúa abajo a la izquierda, dejando libres los controles de paginación.

Compilación correcta y 21 comprobaciones de Playwright CLI correctas con respuestas controladas: doce sobre paginación, borrado/cancelación y avisos de éxito/error, más nueve regresiones de catálogo y detalle. No se escribieron datos en XAMPP. Recorrido: [acabados-catalogo.js](acabados-catalogo.js). Resultados: [comprobaciones](acabados-catalogo-resultados.json) y [regresión](acabados-regresion-resultados.json). Capturas: [borrado](confirmacion-borrado.png) y [aviso](aviso-catalogo.png).
