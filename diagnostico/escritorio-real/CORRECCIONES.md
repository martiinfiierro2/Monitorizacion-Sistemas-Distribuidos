# Correcciones del grafo y etiquetas del mapa

> Este documento describe el cambio del commit `556597e`. La composición posterior sustituye el grafo con desplazamiento vertical por un encuadre dentro de la ventana; se documenta en [Composición y navegación de la interfaz](../interfaz/README.md).

Se corrigen los puntos 1 y 3 del diagnóstico de escritorio. El punto 2 se investiga en [REFRESCO.md](REFRESCO.md) y su lógica permanece intacta.

## Grafo

- Se reserva la altura necesaria para las filas de cada grupo, según el tamaño de los iconos y el espacio de sus nombres.
- Se fija la correspondencia entre las posiciones del grafo y los píxeles disponibles, evitando que el encuadre automático comprima las filas mientras los iconos mantienen su tamaño.
- Se añaden márgenes para nombres y curvas superiores, y se limita la longitud visible de nombres extensos; el tooltip conserva el nombre completo.
- En ventanas más bajas hay desplazamiento vertical. El arrastre y el zoom del grafo se conservan; la barra de desplazamiento permite acceder a las filas inferiores sin reducir su legibilidad.

## Mapa

- Las etiquetas se muestran al pasar el ratón por un nodo, con su nombre y grupo.
- El ancho se adapta al contenido y el texto no se divide arbitrariamente en varias líneas.
- Las etiquetas dejan de mostrarse todas a la vez, evitando que oculten otros nodos y conexiones.

## Verificación

- Playwright CLI con Edge y respuestas reales de la aplicación.
- Cero intersecciones entre iconos o etiquetas y cero recortes medidos en 1280 × 720, 1366 × 768 y 1920 × 1080, después de Ajustar vista.
- Filtro de procesadores y vuelta a todos los nodos: correcto.
- Desplazamiento y clic con el ratón en el nodo inferior P13: abre su detalle correctamente.
- Etiqueta del mapa: aparece al pasar el ratón, se lee en una línea y desaparece al retirarlo.
- Seis comprobaciones correctas y ninguna excepción de página. Resultados: [correcciones-resultados.json](correcciones-resultados.json). Script repetible: [verificar-correcciones.js](verificar-correcciones.js).
- `npm test`: 11 pruebas correctas.
- `npm run build`: correcto, con los avisos ya existentes de Leaflet/CommonJS y tamaño inicial de Fuse.

Las peticiones que registrarían fechas de consulta se abortaron antes de salir del navegador. No se sustituyeron las respuestas de los ejecutables ni se modificó el catálogo.
