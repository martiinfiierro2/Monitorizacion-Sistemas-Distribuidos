# Diagnóstico de representación con datos reales

18 de octubre de 2026. Rama `fix/monitorizacion-fiable`, código `38a8961`. Playwright CLI con Edge contra `http://127.0.0.1:4200`.

## Alcance acordado

Interfaz de escritorio para representar el catálogo y las respuestas de sus ejecutables, con el formato que estos producen. Se revisaron pantallas de 1280 × 720, 1366 × 768 y 1920 × 1080. No se evaluó móvil, no se sustituyeron respuestas de estado y no se apagaron procesos ni se provocaron errores externos.

Se abrieron los detalles de los 18 nodos, se observaron cuatro refrescos automáticos completos, se probaron filtros y seis clics directos en nodos del grafo, y se contrastaron las conexiones con las referencias reales de los procesos. Se guardaron capturas y resultados de cada recorrido.

La apertura de detalles intenta registrar la fecha de consulta mediante PATCH. La revisión automática de permisos bloqueó inicialmente esa ejecución y después una lectura de conexiones al considerar el mismo riesgo. Se completaron ambas comprobaciones abortando únicamente esas escrituras antes de que salieran del navegador. **Las respuestas DEBUG continuaron siendo reales. El catálogo y sus fechas se conservaron.** Esos bloqueos de PATCH son propios de la auditoría y no se contabilizan como errores de la aplicación.

## Fallos confirmados de la interfaz

### R1. El grafo superpone iconos en resoluciones habituales de escritorio

En 1366 × 768 y 1280 × 720 se midieron nueve pares de rectángulos de iconos intersectados. Afecta a parejas de controladores y balanceadores, y a varias filas de procesadores. Los nombres quedan pegados o tapados por los iconos contiguos. El botón Ajustar vista no resuelve la distribución. En 1920 × 1080 no se detectaron intersecciones entre iconos en esta ejecución.

La cantidad se refiere a las capturas de esta ejecución; puede variar con la distribución de grupos y disponibilidad. Los clics probados en el centro de CM1, BM1, P3, P1, P7 y P13 abrieron el detalle correcto, por lo que no se afirma que todos los nodos superpuestos sean inaccesibles.

Causa en el código: posiciones verticales calculadas con separación de 90 unidades, ajuste del conjunto de posiciones al lienzo y tamaño fijo de símbolo de 60 píxeles. Al reducirse la altura útil se comprimen las posiciones sin reducir o redistribuir suficientemente los símbolos y nombres.

Ubicación: `frontend/starter/src/app/modules/admin/grafo/grafo.component.ts:32` y siguientes.

Corrección dentro del alcance: distribuir las filas y grupos según el espacio final que necesitan iconos y nombres; permitir un área mayor con desplazamiento o un encuadre que mantenga su separación.

Capturas: [1366 × 768](grafo-1366x768.png), [1280 × 720](grafo-1280x720.png), [1920 × 1080](grafo-1920x1080.png).

### R2. El refresco representa como desconectados nodos que todavía está consultando

Durante los cuatro refrescos reales observados, el estado estable era 8/18 fichas con respuesta válida. Al comenzar cada nueva ronda se registró brevemente esta secuencia:

```text
8 responden, 4 conexiones
3 responden, 1 conexión; quedan consultas pendientes
7 responden, 4 conexiones; quedan consultas pendientes
8 responden, 4 conexiones; ronda terminada
```

Los estados intermedios duraron aproximadamente 70 ms en estas rondas, sin introducir retrasos artificiales. No representan una caída seguida de una recuperación de cinco procesos: la propia interfaz ha puesto a falso el estado de las consultas pendientes. También recalcula sus grupos y posiciones con esos datos provisionales, lo que produce saltos y parpadeos. La captura durante el refresco muestra otro instante intermedio, 6/18, por el tiempo transcurrido entre detectar el estado y realizar la captura.

Causa: `MonitorService.round` inicializa cada ronda con todos los nodos en `status: false, pending: true`. La cabecera, los filtros, los iconos y los enlaces utilizan `status` sin distinguir pendiente de consulta fallida.

Ubicación: `frontend/starter/src/app/services/monitor.service.ts:39`, `frontend/starter/src/app/modules/admin/monitor-view.ts:20` y `monitor-toolbar.component.ts:48`.

Corrección dentro del alcance: conservar el último estado confirmado mientras llega una nueva respuesta y actualizarlo al recibir el resultado de esa consulta. El indicador de consulta pendiente debe ser independiente de la disponibilidad.

Capturas: [estado estable](refresco-estable.png), [durante el refresco](refresco-en-curso.png). Las secuencias exactas están en `refresco_real_sin_interceptar` de [revision-visual-resultados.json](revision-visual-resultados.json).

### R3. Las etiquetas del mapa tienen un ancho insuficiente

Con los datos reales, una etiqueta corta como `CM1 · Grupo 1` queda en una caja de aproximadamente 47 × 68 px y se divide en varias líneas. Al mostrar todos los nodos, las cajas altas se superponen y tapan otros nombres, iconos o líneas. El problema del ancho se mantiene al filtrar únicamente los controladores principales, aunque estos estén separados por miles de kilómetros y haya espacio disponible.

Esto se distingue del solapamiento geográfico normal de dos marcadores cercanos: el ancho de las etiquetas es insuficiente incluso cuando se muestran solo dos nodos alejados.

Ubicación: `.leaflet-tooltip{white-space:normal}` en `frontend/starter/src/app/modules/admin/monitoring.scss` y creación de etiquetas en `mapa.component.ts:39`.

Corrección dentro del alcance: definir un ancho que permita leer nombre y grupo en una o dos líneas; decidir cuándo mostrar las etiquetas para que no oculten las conexiones.

Capturas: [todos los nodos](mapa-real.png), [solo controladores principales](mapa-etiquetas-controladores.png). Medidas en `etiquetas_del_mapa` de [interacciones-resultados.json](interacciones-resultados.json).

### R4. El mapa pierde la selección de teclado al actualizarse

Se enfocó un marcador real y se esperó el refresco normal de cinco segundos. El foco pasó de `IMG[role=button]` al cuerpo de la página. No hubo cambios de datos ni de pantalla que justificasen perderlo.

Es un defecto menor de interacción en escritorio, independiente de móvil. La causa es que cada renderizado elimina todos los marcadores y los crea de nuevo.

Ubicación: `frontend/starter/src/app/modules/admin/mapa/mapa.component.ts:31`.

Corrección dentro del alcance: actualizar los marcadores existentes por identificador y mantener el foco del que sigue representándose.

Evidencia: `mapa_foco_con_refresco_real` de [revision-visual-resultados.json](revision-visual-resultados.json).

## Problema confirmado en los datos, separado de la interfaz

**P2 y P8 son dos fichas del mismo ejecutable.** Ambas apuntan, tras normalizar la dirección, a `http://127.0.0.1:4002` y ambas devuelven `internalConfig.name: process2`. Por eso aparecen dos nodos con el mismo estado y ambas fichas se contabilizan entre las que responden. La aplicación muestra el aviso de dirección duplicada.

Durante la revisión respondían ocho fichas que correspondían a siete direcciones de proceso diferentes. Esto no demuestra un fallo del contador —cuenta fichas del catálogo—, pero sí que ese catálogo no representa 18 ejecutables diferentes.

No se corrigió ni eliminó ninguna ficha. Evidencia: P2 y P8 en [conexiones-resultados.json](conexiones-resultados.json) y [revision-detalles-resultados.json](revision-detalles-resultados.json).

## Representación que sí se confirmó correcta

Las siguientes relaciones estaban respaldadas por las respuestas de los procesos y se dibujaban correctamente una vez completada la ronda:

| Relación dibujada | Datos que la respaldan |
|---|---|
| CM1 → BM1 | El controlador principal configura `urlBalancerMain` con el puerto 3100, y BM1 responde. |
| BM1 → P3 | El balanceador selecciona `process3`, puerto 4003, con reparto 100 %. |
| CS2 → BM2 | `coordinatorSubsActive` es `true`; su balanceador principal está en el puerto 4100. |
| BS2 → BM2, supervisión | BS2 responde, está en espera y tiene `urlMain` configurado al puerto 4100. |

BM2 no tenía procesadores seleccionados y la interfaz no dibujaba conexiones de reparto salientes inventadas. P2 estaba registrado en CM1 pero no seleccionado para reparto; tampoco se le dibujaba una asignación desde BM1. Los datos de procesos registrados y destinos seleccionados del detalle coincidían con sus respuestas.

También se comprobaron:

- Los 18 detalles: ocho fichas con estado válido y diez con error real de conexión en ese momento.
- Los filtros por grupo, tipo y estado en las condiciones reales de la revisión.
- Ocultar las líneas y volver a mostrarlas.
- Apertura del detalle correcto en los seis clics de grafo probados.
- Conservación del zoom del grafo: 1,1 antes y después de un refresco real.
- Ausencia de excepciones de página en el recorrido visual.
- Catálogo conservado: 18 fichas, sin cambios estructurales ni cambios de fecha durante la revisión de detalles.

Las respuestas 502 de nodos apagados o inaccesibles se muestran como fallos de consulta; no se presentan como defectos nuevos del frontend. Tampoco se incluyen los casos artificiales de la auditoría anterior, adaptación móvil, ni hipótesis de modificaciones externas.

## Archivos y repetición

Los resultados y capturas quedan en esta carpeta. Los scripts usan la API de depuración de Angular para medir la representación; requieren el servidor de desarrollo en el puerto 4200.

```powershell
playwright-cli -s=escritorio open about:blank --browser=msedge
playwright-cli -s=escritorio run-code --filename=diagnostico/escritorio-real/revision-visual.js
playwright-cli -s=escritorio run-code --filename=diagnostico/escritorio-real/revision-detalles.js
playwright-cli -s=escritorio run-code --filename=diagnostico/escritorio-real/interacciones.js
playwright-cli -s=escritorio run-code --filename=diagnostico/escritorio-real/conexiones.js
playwright-cli -s=escritorio close
```

Primero corregiría R1 y R2; después R3. R4 tiene menor impacto. El duplicado P2/P8 requiere revisar el catálogo. Este diagnóstico no añade cambios funcionales a la aplicación.
