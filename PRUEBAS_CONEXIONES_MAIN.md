# Pruebas de conexiones de main

Fecha: 18 de octubre de 2026. Commit: `3ac9acd6d861f3fa50983522a8c7959e7d584983`.

Resultados detallados: [conexiones-resultados.json](diagnostico/conexiones-resultados.json). Diagnóstico previo: [DIAGNOSTICO_MAIN.md](DIAGNOSTICO_MAIN.md).

## Conclusión

El recorrido normal y la sustitución básica funcionan. El mayor problema encontrado está en la combinación **coordinador sustituto activo + caída de un procesador**: el sistema puede seguir seleccionando al procesador caído y perder mensajes aunque exista otro disponible.

La visualización también necesita correcciones antes de poder utilizarse como referencia fiable. Grafo y mapa tienen reglas diferentes, pueden mostrar conexiones o nodos antiguos y un dato mal formado puede impedir representar el conjunto.

## Alcance y método

- Se consultaron los 18 nodos reales del catálogo y se inspeccionaron el grafo y el mapa reales en navegador. No se modificó el catálogo ni se detuvieron los procesos del usuario.
- Se probaron 16 escenarios de conexiones en **cada vista**: 32 casos, con dos grupos independientes y dos procesadores por grupo. Se inspeccionaron los enlaces renderizados por ECharts y las líneas activas de Leaflet, no solo las respuestas de la API.
- Se probaron 12 escenarios de actualización y uso en cada vista: 24 casos adicionales. Las repeticiones para precisar tiempos o cancelación no se cuentan como casos nuevos.
- Las respuestas HTTP del catálogo y DEBUG se controlaron en páginas independientes del navegador. Para aislar el refresco, se invocó la misma función `comprobar()` que llama el temporizador; la recuperación de la API se comprobó con el temporizador automático.
- Se arrancaron dos grupos de procesos Node reales en puertos de prueba: cuatro coordinadores, cuatro balanceadores y cuatro procesadores. Se probaron registro, reenvío, caída, sustitución, caída de procesadores y recuperación. La entrada MQTT se sustituyó por eventos locales controlados y los intervalos AYA se aceleraron.
- También se comprobaron la configuración vacía del balanceador, el reparto por pesos, la reducción de destinos y los nombres de los scripts del segundo grupo.
- La copia compilada de main usada para las simulaciones contiene el mismo commit que el directorio de trabajo. No se modificó código de aplicación.

Estas pruebas no certifican el broker TTN real, entrega garantizada bajo cualquier fallo, particiones de red, carga de producción ni funcionamiento prolongado. Los escenarios sobre sustitutos todavía no activos contrastan la representación de una conexión **operativa** con el indicador de rol que devuelve el proceso; una relación configurada podría mostrarse por separado con otra leyenda.

## Estado real encontrado

| Grupo o elemento | Resultado |
|---|---|
| Primer grupo | CM1, BS1 y P3 responden a DEBUG. CM1 tiene a `process3` registrado y seleccionado con carga 100 %. BS1 está en sustitución activa. |
| Segundo grupo | Sus coordinadores, balanceadores y procesadores consultados rechazan la conexión. No se ha interpretado esto como un fallo de visualización: no hay procesos escuchando en esos destinos. |
| Grafo real | 18 nodos dibujados; conexiones CM1 → BS1 y BS1 → P3. |
| Mapa real | Los mismos 18 nodos y las mismas dos conexiones. |
| P8 | Dirección inválida: `http://localhost:4002:4002`. |
| Supervisión de BS1 | El contador AYA seguía descendiendo; llegó a -98 durante esta revisión. |

El segundo grupo se probó funcionalmente en aislamiento. No se arrancaron sus scripts sobre los puertos del usuario, porque pueden conectar con TTN y alterar el sistema que estaba utilizando.

## Matriz de conexiones

En los casos normales hay cinco conexiones por grupo: CM → BM; CS → CM; BS → BM; BM → P; BM → Q. Los enlaces de supervisión y de asignación no representan tráfico observado.

| Escenario | Grafo | Mapa | Observación |
|---|---|---|---|
| Dos grupos normales | Correcto | Correcto | Diez conexiones, sin cruces entre grupos. |
| Cae BM1 y BS1 está activo | Correcto | Correcto | CM1 → BS1 y BS1 → procesadores. |
| Cae CM1 y CS1 está activo | Correcto | Correcto | CS1 → BM1. |
| Caen los dos principales del grupo 1 | Correcto | Correcto | CS1 → BS1 → procesadores. El grupo 2 mantiene sus conexiones. |
| Todos los procesos caídos | Correcto | Correcto | No hay enlaces operativos. |
| Procesador caído, pero aún en lista de balanceo | Incorrecto | Correcto | El grafo mantiene un enlace verde al procesador que no responde. |
| Procesador oculto con BM principal | Correcto | Correcto | ECharts omite el enlace aunque siga en la configuración interna. |
| Procesador oculto con BS sustituto activo | Correcto | Incorrecto | El mapa dibuja una línea hacia la posición del marcador oculto. |
| BM caído y BS aún no ha asumido el rol | Incorrecto | Parcial | El grafo dibuja BS → procesadores pese a `balancerSubsActive=false`. El mapa no dibuja esos destinos, pero sí CM → BS. |
| CM caído y CS aún no ha asumido el rol | Incorrecto | Correcto | El grafo dibuja CS → BM pese a `coordinatorSubsActive=false`. |
| BM no está en el catálogo y BS está activo | Incorrecto | Correcto | El grafo pierde las conexiones del sustituto y del controlador que depende de él. |
| CM no está en el catálogo y CS está activo | Incorrecto | Incorrecto | Ambos pierden CS → balanceador, al buscar una ficha del principal que no existe. |
| El catálogo usa localhost y DEBUG usa 127.0.0.1 para el mismo destino | Incorrecto | Incorrecto | El proceso contesta, pero el enlace desaparece por comparación literal de URL. |
| Un balanceador responde 200 con DEBUG mal formado | Falla el conjunto | Falla el conjunto | Excepción al acceder a `Data.balancerList`. |
| Un nodo tiene una coordenada no numérica | No afecta al grafo | Falla el conjunto | Leaflet lanza `Invalid LatLng object`. |
| Un nodo tiene un tipo desconocido | Falla el conjunto | Lo tolera | Grafo accede a una zona inexistente; mapa lo representa como procesador, sin advertir del dato inválido. |

La ocultación es una preferencia visual: no debería cambiar el rol operativo ni dejar líneas hacia marcadores ausentes. La identidad del destino debería ser estable; la equivalencia localhost/127.0.0.1 se probó específicamente en el mismo equipo y no implica que cualquier hostname sea intercambiable.

## Matriz de cambios con la vista abierta

| Cambio o acción | Grafo | Mapa |
|---|---|---|
| Cambiar nombre | Conserva la etiqueta anterior. | Actualiza la etiqueta. |
| Ocultar un nodo | Puede seguir dibujándolo. | Retira el marcador en el caso principal probado. |
| Añadir un nodo | Excepción leyendo `datos` del elemento anterior inexistente. | Excepción leyendo `nodo` del elemento anterior inexistente. |
| Eliminar el último nodo | Conserva el nodo eliminado si los restantes no cambian. | Conserva el marcador eliminado. |
| Vaciar el catálogo | Conserva el dibujo anterior. | Conserva los marcadores anteriores. |
| Cambiar lista de destinos sin cambiar disponibilidad | Actualiza las conexiones. | Mantiene las anteriores. |
| Caer un procesador que sigue en lista de destinos | Sigue dibujando el enlace operativo. | Retira el enlace. |
| Reducir ventana a 640 px | Lienzo de 1.180 px en contenedor de 540 px. | Ajusta el lienzo al contenedor de 460 px. |
| Desactivar y volver a activar conexiones | Funciona. | Funciona. |
| Fallo temporal 500 en catálogo y posterior recuperación | Detiene el sondeo y no se recupera solo. | Sigue consultando y se recupera en el caso probado. |
| Un único DEBUG tarda 1,8 s | Retiene la actualización de toda la ronda hasta que termina. | También espera al conjunto; además puede ignorar el cambio por no comparar DEBUG. |
| Navegar a lista mientras queda una consulta pendiente | La respuesta tardía vuelve a programar un temporizador de la vista destruida. | El temporizador queda cancelado en el caso probado. Las peticiones pendientes no se cancelan explícitamente. |

El caso de lentitud demuestra dependencia de toda la ronda respecto a un único nodo, no incumplimiento de un tiempo de respuesta pactado. En el código no se fija timeout por consulta. El fallo de inicialización por cargar configuración y grafo en paralelo y el caso de catálogo inicialmente vacío se habían reproducido en el diagnóstico anterior.

## Procesos reales en aislamiento

| Prueba | Resultado |
|---|---|
| Registro en dos grupos independientes | Ambos coordinadores principales y sus sustitutos contienen sus dos procesadores; no aparecen procesadores del otro grupo. |
| Reenvío normal de cuatro mensajes por grupo | Cada procesador recibió dos. |
| Caída de CM y BM del grupo A | CS y BS de A asumieron el rol; B siguió funcionando. |
| Mensajes desde BS activo | Los dos procesadores de A recibieron mensajes de prueba tras la sustitución. |
| Caída de un procesador en B, con CM principal | El coordinador lo retiró y el balanceador seleccionó al superviviente. Este recibió el siguiente mensaje. |
| Caída de un procesador en A, con CS sustituto | CS conservó al caído. BS terminó seleccionando únicamente al caído, pese a existir un procesador vivo. El mensaje posterior no llegó al superviviente. Reproducido en dos ejecuciones. |
| Volver a arrancar CM y BM de A | Los sustitutos volvieron a espera; se recuperó la lista con el procesador superviviente. |
| Procesador arrancado antes de su coordinador | El procesador responde a DEBUG, pero el coordinador arrancado después no lo tiene registrado. No se reintenta el registro. |
| SETCONFIG con lista vacía | Devuelve 200 y DEBUG confirma `balancerList: []`. Este caso sí funciona. |
| Pesos 90/10 con diez mensajes | Reparto real 5/5: no se aplican los pesos. |
| Reducir dos destinos a uno con el pivote en el segundo | El siguiente mensaje no se reenvía; se accede a una posición fuera de la lista y el error se silencia. |
| Un mensaje y 60 s posteriores sin tráfico | `totalMeters()` sigue devolviendo 1 con reloj controlado. |

Los temporizadores acelerados permiten reproducir la lógica de sustitución; no sustituyen una prueba de resistencia con los intervalos reales.

## Qué hay que pulir, por prioridad

### Alta: evitar pérdida de mensajes y estados falsos

1. **Completar la supervisión del coordinador sustituto.** Al asumir el rol no se activa el ciclo `processorsResendAYA` que elimina procesadores agotados; en cambio se vuelven a programar ciclos AYA mientras sigue caído el principal. Debe existir un único ciclo de supervisión por rol y cancelar el anterior al cambiar de estado. Referencia: `backend/v2/coordinator/c_coordinator.js`, `activateAYA`, `coordinatorAYA`, `processorsAYA` y `processorsResendAYA`.
2. **Ajustar o reiniciar el pivote cada vez que cambia la lista de balanceo.** Debe seguir enviándose el siguiente mensaje al reducir destinos; no silenciar accesos fuera de rango. Referencia: `backend/v2/balancer/c_balancer.js`, `resendMessage`, y `balancer/functions.js`, `updateBalancerList`.
3. **Definir qué ocurre cuando falla un envío.** Ahora los errores HTTP se silencian y no hay confirmación de entrega al procesador, reintento ni cola. Si se requieren reintentos, añadir identificadores e idempotencia para evitar duplicados. No considerar «recibido por balanceador» equivalente a «entregado».
4. **Unificar el cálculo de conexiones para grafo y mapa.** Partir de una topología común con disponibilidad, rol real y visibilidad separados. Validar origen y destino antes de representar una conexión operativa. No inferir sustitución solo porque el principal no responde.
5. **Dejar de depender de que el principal figure en el catálogo para representar al sustituto.** La configuración y el indicador de rol del sustituto ya proporcionan esa información.
6. **Comparar las rondas por ID estable y contemplar cambios del conjunto.** Altas, bajas, catálogo vacío y cambio de orden no pueden compararse mediante el mismo índice del array anterior. Actualizar metadatos y DEBUG en ambas vistas.
7. **Aislar errores por nodo.** Validar la estructura DEBUG antes de usarla y mostrar ese nodo como inválido; una respuesta incorrecta no debe romper el dibujo de todos. Esperar a la configuración antes de inicializar el grafo.
8. **Hacer recuperable el sondeo.** Timeout por nodo, gestión de errores del catálogo y reintento; cancelar peticiones y temporizadores al salir. Impedir que una respuesta tardía reactive el grafo destruido. Evitar rondas solapadas en el mapa.

### Media: coherencia de datos, arranque y medidas

9. **Dar nombres únicos a los procesadores del segundo grupo.** `processor/run4.bat`, `run5.bat` y `run6.bat` arrancan todos como `process1` en 5002, 5003 y 5004. El `addProcessor` real devuelve 1, 0, 0 con esos argumentos: solo acepta el primero. Pueden verse tres procesos activos en el catálogo y tener solo uno registrado operativamente.
10. **Reintentar el registro y permitirlo contra el coordinador operativo.** Arrancar fuera de orden o mientras el principal está caído no debe dejar un procesador vivo pero desconectado del sistema. El registro al sustituto está comentado en `processor/processor.js`.
11. **Reprogramar `updateConfig` periódicamente.** La función actual se ejecuta una vez por activación; otros eventos pueden actualizar la lista, pero no suplen el sondeo previsto.
12. **Definir unidades y reparar la ventana de carga.** `totalMeters` suma diez posiciones de un segundo y no envejece al consultar. Las capacidades se describen en mensajes por segundo. Elegir una unidad común y actualizar la ventana incluso sin nuevos mensajes.
13. **Aplicar los pesos calculados o declarar reparto uniforme.** La interfaz muestra porcentajes de carga que el pivote no utiliza.
14. **Normalizar direcciones e identificar nodos de forma estable.** Resolver el puerto duplicado de P8, separar host/puerto sin concatenación ambigua y conciliar los destinos de DEBUG con el catálogo. Mostrar destinos operativos que faltan del catálogo como elementos pendientes de identificar, no ocultarlos sin aviso.
15. **Validar tipo, puerto, URL y coordenadas en la API.** Ahora se comprueba fundamentalmente que no estén vacíos. Rechazar tipos desconocidos, puertos fuera de rango, coordenadas no numéricas y latitud/longitud fuera de sus rangos; tolerar el dato inválido al representar conjuntos antiguos. La base almacena coordenadas como texto.
16. **Distinguir el catálogo de la lista operativa.** Guardar una ficha no arranca ni registra un proceso. Mostrar «responde a DEBUG», «registrado», «seleccionado para balanceo» y «sustituto activo» como hechos distintos.
17. **Revisar qué significa “última consulta”.** El diálogo solo lee DEBUG una vez; al cerrarse actualiza la fecha incluso aunque DEBUG falle. Guardar la última consulta correcta, mostrar cuándo quedó obsoleto el dato y gestionar el cierre antes de terminar la carga.
18. **Mostrar registrados y seleccionados por separado en el detalle.** El controlador recibe `processorsList`, pero la tabla visible utiliza `balancerList`. Un procesador registrado pero no seleccionado puede quedar fuera de la explicación que ve el usuario.
19. **Corregir búsqueda, borrado y duplicados del catálogo.** Búsqueda sin resultados debe vaciar la tabla y mostrar un mensaje; añadir cancelación/debounce. Main no tiene borrado. La comprobación previa de URL/puerto en código debe acompañarse de una restricción de unicidad si se quiere impedir duplicados concurrentes.
20. **Limitar los contadores AYA a una representación comprensible.** El contador negativo no invalida por sí solo la sustitución, pero no expresa «intentos restantes». Separar intentos, fallos acumulados y hora del último contacto.

### Presentación, mantenimiento y despliegue

21. **Ajustar el grafo al tamaño disponible.** Usar redimensionado del lienzo, recalcular posiciones y liberar ECharts/Leaflet al destruir la vista. En el código actual no se llama a `dispose()` del chart ni a `remove()` del mapa.
22. **Explicar las conexiones.** Añadir leyenda para supervisión frente a asignación y diferenciar «configurada» de «operativa». El mapa dibuja líneas grises sin flechas; el grafo tiene flechas y colores. El usuario no debería deducir tráfico a partir de una línea.
23. **Facilitar la lectura de los dos grupos.** Etiquetas de grupo y rol actual, filtros por grupo/tipo/estado, ajuste de vista al conjunto o selección y nombre completo accesible para etiquetas truncadas. Son mejoras de uso propuestas, no fallos de protocolo.
24. **Mostrar errores y estados vacíos en pantalla.** API caída, URL inválida, timeout, DEBUG incorrecto y proceso detenido se mezclan o quedan en consola. Ofrecer fecha del último refresco y estado de datos antiguos.
25. **Hacer reproducible la instalación.** Esquema y semilla MySQL, configuración de ejemplo, dependencias declaradas —falta `cors` en miback—, versión de Node documentada y comandos para arrancar cada grupo sin nombres repetidos. Reducir duplicación de `.env` y retirar dependencias versionadas después de asegurar la instalación limpia.
26. **Preparar el acceso si se despliega.** URLs por entorno, conectividad desde el navegador o un recolector central, autenticación/autorización de catálogo y SFMP, y gestión de secretos fuera del repositorio. Revisar y rotar la clave TTN expuesta si sigue vigente. Estos puntos ya estaban identificados en el diagnóstico inicial.
27. **Convertir los casos críticos en regresiones automáticas.** Priorizar: caída de procesador bajo CS, reducción de destinos, registro tardío, alta/baja/vacío, recuperación tras 500, cancelación al navegar y paridad de topología entre grafo/mapa. Los resultados JSON adjuntos documentan las reproducciones; no son una suite de CI instalada en el proyecto.

## Orden de trabajo recomendado

Primero resolver supervisión y entrega —puntos 1–3— y los nombres de los scripts. Después construir un cálculo común de topología y un sondeo resistente —4–8—. A continuación cerrar normalización, medidas, registro y validación. Por último pulir presentación y despliegue.

Para considerar recuperada la base del proyecto, la prueba de aceptación sería: dos grupos arrancan desde configuración documentada; cada uno registra todos sus procesadores; al caer un principal o un procesador se conserva el servicio con los supervivientes; al recuperarse se reconcilian los estados; grafo, mapa y detalle muestran la misma topología y se recuperan de errores sin recargar la página.
