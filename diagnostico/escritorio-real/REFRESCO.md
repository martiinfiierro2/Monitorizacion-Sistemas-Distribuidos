# Investigación del refresco: causa localizada, sin corregir

La lógica de consulta, estados y construcción de conexiones se conserva sin cambios. Se han modificado únicamente la distribución visual del grafo y la presentación de las etiquetas del mapa.

## Cómo se actualiza actualmente

1. `ConfigService` carga `assets/theme/config.json`. El intervalo configurado es 5000 ms.
2. `MonitorService.watch` combina un temporizador inmediato y cada cinco segundos con el botón Actualizar. `exhaustMap` evita iniciar otra ronda mientras la anterior sigue en curso; una pulsación durante una ronda no inicia otra en paralelo.
3. Cada ronda consulta `/api/nodosOrden` para obtener las fichas actuales del catálogo.
4. Para cada ficha prepara una petición de estado. Se ejecutan hasta ocho simultáneamente mediante `mergeMap(..., 8)`.
5. El frontend usa GET `/api/nodo/:id/debug`. La API consulta el ejecutable con POST `/sfmp` y operación DEBUG. El timeout predeterminado del proxy es 2500 ms y el del cliente DEBUG es 3000 ms.
6. Las respuestas se incorporan una a una mediante `scan`. `auditTime(25)` agrupa estos avances y puede publicar varios estados parciales durante la misma ronda. No espera a que todos los ejecutables hayan respondido.
7. Cada publicación recalcula topología, grupos y fecha `refreshedAt`. `MonitorView` entrega inmediatamente ese estado a la cabecera y al dibujo.

## Dónde está el problema

La lista inicial de cada ronda se construye así:

```typescript
{ nodo, endpoint, datos: null, status: false, pending: true }
```

Cuando llega el primer grupo de respuestas, quedan otros nodos en ese estado provisional. Aunque `pending` indica que todavía se están consultando, las vistas interpretan `status: false` igual que una consulta terminada con error:

- La cabecera cuenta solo los nodos con `status: true`.
- Los iconos usan la variante desconectada cuando `status` es falso.
- El filtro Sin respuesta válida también incluye esas consultas pendientes.
- La topología exige que ambos extremos tengan estado verdadero para dibujar una conexión.
- La agrupación se vuelve a inferir con las respuestas disponibles en ese momento, de modo que algunas posiciones y grupos pueden cambiar provisionalmente.

El redibujado hace visible esa transición. El grafo reemplaza sus opciones en cada publicación; el mapa, además, elimina sus marcadores y líneas y los crea de nuevo. Esto contribuye al parpadeo, pero el descenso falso del contador y de las conexiones nace antes, en la lista provisional de la ronda.

## Evidencia con los ejecutables reales

En cuatro rondas observadas con Playwright CLI, sin introducir retrasos, errores ni respuestas falsas, se registró esta secuencia:

| Momento de la ronda | Fichas con respuesta representadas | Conexiones |
|---|---:|---:|
| Estado estable anterior | 8 | 4 |
| Primer avance, con consultas pendientes | 3 | 1 |
| Siguiente avance, aún con pendientes | 7 | 4 |
| Ronda terminada | 8 | 4 |

En el primer refresco medido, el primer avance llegó a las `12:37:00.238 UTC` y la ronda quedó completa a las `12:37:00.306 UTC`: 68 ms después. En los otros tres ciclos se repitió el mismo patrón. Los tiempos dependen de las respuestas reales; no son una duración fija del defecto.

La captura del estado pendiente mostró 6/18 porque se tomó en otro instante de esa misma actualización, después de la muestra que recogió 3/18. No se afirma que cinco procesos se cayesen y recuperasen en esos milisegundos: sus consultas todavía estaban pendientes y después devolvieron estado válido.

Los datos reducidos del recorrido están en [refresco-observaciones.json](refresco-observaciones.json).

## Conclusión

El problema principal es **confundir pendiente de nueva consulta con consulta fallida** y mostrar ese estado provisional como disponibilidad confirmada. El intervalo de cinco segundos y la protección contra rondas simultáneas no explican por sí mismos esa bajada falsa.

Una corrección futura podría conservar el último estado confirmado hasta recibir el nuevo resultado, manteniendo pendiente como indicador separado. Otra opción sería publicar únicamente la ronda completa, a costa de esperar también a los nodos más lentos o a sus timeouts. Ninguna de esas alternativas se ha implementado en este trabajo.

Archivos investigados y conservados sin cambios:

- `frontend/starter/src/app/services/monitor.service.ts`, especialmente inicialización de pendientes, `mergeMap`, `scan`, `auditTime` y `watch`.
- `frontend/starter/src/app/services/config.service.ts`.
- `frontend/starter/src/app/services/grafo.service.ts`.
- `frontend/starter/src/app/services/topology.ts`.
- `frontend/starter/src/app/modules/admin/monitor-view.ts`.
- `frontend/starter/src/app/modules/admin/monitor-toolbar.component.ts`.
- `backend/miback/controllers/nodo.js`.
