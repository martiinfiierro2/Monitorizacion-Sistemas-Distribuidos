# Composición y navegación de la interfaz de escritorio

La interfaz se ha ajustado al espacio de la ventana. La lógica de consulta, disponibilidad y topología permanece igual.

## Ubicación del estado pendiente

El `status: false` que se comentó está en `frontend/starter/src/app/services/monitor.service.ts:42`, al crear la lista inicial de cada ronda:

```typescript
return { nodo, endpoint, datos: null, status: false, pending: true };
```

Ese servicio se conserva sin cambios. La investigación sigue disponible en [REFRESCO.md](../escritorio-real/REFRESCO.md).

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
