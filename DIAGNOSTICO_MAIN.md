# Diagnóstico de main — 18 de octubre de 2026

Ampliación posterior con pruebas de los dos grupos, grafo y mapa: [PRUEBAS_CONEXIONES_MAIN.md](PRUEBAS_CONEXIONES_MAIN.md).

Versión revisada: `3ac9acd6d861f3fa50983522a8c7959e7d584983` (`tfg`).

La revisión se ha realizado sobre una copia de `git archive main`. El directorio de trabajo estaba en `develop`, con una modificación previa en `frontend/starter/src/app/modules/admin/dialogs/dialog.html`; se ha conservado. Las referencias y líneas de este documento corresponden a **main**, y pueden diferir de las de develop.

## Valoración

El proyecto tiene una base funcional de monitorización especializada: consulta estados reales de procesos que hablan SFMP, representa nodos y relaciones y dispone de un catálogo persistente mediante una API MySQL. También contiene la implementación de los procesos distribuidos, con registro, mensajes de supervisión y sustitución de principales.

Su estado es el de un prototipo demostrable, condicionado a preparar el entorno. No se puede considerar un monitor fiable para uso continuado: se han reproducido fallos que detienen el refresco o mantienen representaciones antiguas sin avisar al usuario. La persistencia real del catálogo y la entrada real de The Things Network quedan pendientes de validación.

No es un monitor genérico de cualquier ejecutable. Espera procesos con el endpoint `POST /sfmp` y un formato `DEBUG` concreto. No se ha encontrado captura de CPU/RAM del sistema operativo, instrumentación de ejecutables arbitrarios, históricos de métricas ni alertas. Esto describe su alcance, no implica que fueran requisitos del TFG.

## Qué contiene y cómo circulan los datos

| Carpeta | Función encontrada |
|---|---|
| `frontend/starter` | Interfaz principal Angular 17/Fuse: grafo ECharts, lista y mapa Leaflet. |
| `frontend/frontfog` | Otra interfaz Angular 18, más sencilla, con topología fija de dos balanceadores, dos coordinadores y tres procesadores. |
| `backend/miback` | API Express/Sequelize para consultar, buscar, crear y editar el catálogo `nodos` en MySQL. |
| `backend/v2` | Procesos de coordinación, balanceo y procesamiento, protocolo SFMP, supervisión AYA y entrada MQTT. |

El navegador consulta el catálogo en `http://localhost:8080/api` y después consulta **directamente cada proceso** con `POST <url>:<puerto>/sfmp`. Las métricas recibidas permanecen en memoria del navegador; MySQL guarda los datos descriptivos del nodo, visibilidad, orden y fecha de consulta.

Las altas en el catálogo no arrancan ejecutables ni registran por sí mismas procesadores en los coordinadores. El registro operativo sucede al arrancar el procesador. Son dos listas separadas, sin descubrimiento automático entre ellas.

## Comprobado funcionando

| Prueba | Resultado y alcance |
|---|---|
| Compilación de `starter` en desarrollo | `npm run build -- --configuration development`: correcta con las dependencias locales existentes. |
| Compilación de `frontfog` | `npm run build`: correcta, con aviso de tamaño inicial de 570,83 kB frente a presupuesto de 512 kB. |
| Renderizado de la interfaz principal | Grafo con nodos, mapa con marcadores y tabla con filas comprobados en Edge/Playwright con respuestas controladas. |
| Arranque de `miback` | El servidor escucha y atiende peticiones. Arrancar no comprueba la disponibilidad de MySQL. |
| Validación de campos del catálogo | `POST /api/nodo` con cuerpo vacío devuelve 400 y errores de campos. |
| Estado interno SFMP | Balanceador principal y sustituto, coordinador principal y sustituto y procesador devuelven 200 a la petición `DEBUG` que utiliza la interfaz, incluido `UID: 0` y `Data: {}`. |
| Registro del procesador | Un procesador arrancado aparece en el coordinador principal, se replica al sustituto y aparece en las listas de balanceo. |
| Reenvío de mensajes | Un mensaje introducido mediante un cliente MQTT simulado llega al endpoint `/msg` del procesador real de prueba. |
| Sustitución básica | Tras parar balanceador y coordinador principales, los dos sustitutos pasan a activos y el coordinador conserva el procesador registrado. |

Para las pruebas distribuidas se usaron puertos aislados y temporizadores acelerados. Se sustituyó exclusivamente la conexión MQTT externa para inyectar mensajes controlados. No se ha certificado la integración con TTN, la recuperación de principales, particiones de red, ausencia de pérdidas o duplicados, ni funcionamiento prolongado.

## Fallos reproducidos

### 1. El grafo puede fallar al abrirse por una carrera de inicialización

`grafo.component.ts:40` lanza `initConfig()` e `initChart()` por separado. Si el catálogo y DEBUG llegan antes que el JSON de configuración, el dibujo accede a `this.configuracion` sin inicializar.

Reproducción en navegador: `Cannot read properties of undefined (reading 'processor')`. El grafo no termina de inicializarse. Hay que encadenar la carga de configuración y la carga del grafo.

### 2. Añadir nodos puede detener el refresco del grafo

`grafo.component.ts:294` compara las respuestas nuevas con las anteriores por posición, sin comprobar si existe el elemento anterior.

Reproducción: abrir con un nodo, añadir otro al catálogo servido y esperar al sondeo. Resultado: `Cannot read properties of undefined (reading 'datos')`. El siguiente temporizador se programa después del bloque que falla y ya no llega a programarse. Debe compararse por ID y contemplar altas, bajas y cambios de orden. El mapa usa el mismo patrón de acceso sin protección en `mapa.component.ts:130` —riesgo identificado por lectura, no reproducido por separado—.

### 3. El grafo puede ignorar cambios de nombre, visibilidad y posición

`grafo.component.ts:293` compara únicamente `datos.Data` y el estado de la petición, aunque el dibujo también depende de los datos del catálogo.

Reproducción: cambiar nombre y visibilidad manteniendo DEBUG idéntico. Tras el sondeo, el gráfico conservó `Audit 1` y `visible: true`, pese a que la respuesta del catálogo ya contenía otro nombre y `visible: false`.

### 4. El mapa puede mostrar conexiones antiguas

`mapa.component.ts:129` compara los datos del catálogo y la disponibilidad, pero no el contenido de DEBUG del que salen las conexiones.

Reproducción: pasar de una lista de balanceo vacía a una que contiene el procesador, con los mismos nodos y estado HTTP correcto. Tras el sondeo, el mapa siguió con cero conexiones. Deben incluirse los cambios de topología en la detección.

### 5. Un catálogo vacío deja el grafo sin iniciar su sondeo

Se usa `forkJoin([])`, que completa sin emitir el valor necesario para ejecutar el bloque de inicialización y programar las siguientes consultas.

Reproducción: con cero nodos, hubo una única consulta al catálogo; tras más de un intervalo no hubo otra. El caso vacío necesita una respuesta explícita y un estado de pantalla propio.

### 6. Una búsqueda sin coincidencias muestra resultados anteriores

La API responde 404 cuando no encuentra coincidencias (`controllers/nodo.js`, `buscarNodos`), mientras que `lista.component.ts`, `buscarNodos`, solo atiende respuestas correctas.

Reproducción en navegador: una búsqueda inexistente dejó las dos filas anteriores visibles y produjo un `HttpErrorResponse`. Conviene devolver una colección vacía y mostrar un estado sin resultados. También faltan debounce y cancelación de búsquedas anteriores.

### 7. La actualización periódica de carga no es periódica

`backend/v2/coordinator/c_coordinator.js:338` programa una llamada a `updateConfig`, pero la función de la línea 343 no vuelve a programarse.

Reproducción: después de la primera ejecución se cambió el contador del balanceador a 500. Pasado otro intervalo, el coordinador siguió con -1. Otros eventos pueden desencadenar una actualización, pero no existe el refresco periódico esperado.

### 8. Los porcentajes de carga no se aplican al reparto

`backend/v2/balancer/c_balancer.js`, `resendMessage`, avanza un pivote de forma circular. No utiliza el campo `load` calculado por el coordinador.

Reproducción aislada: configuración de dos destinos con cargas 90 y 10; diez mensajes terminaron repartidos 5 y 5. La selección de qué procesadores participan sí existe, pero el reparto entre los seleccionados es uniforme.

### 9. La medida de carga conserva valores antiguos durante la inactividad

`backend/v2/balancer/loadMeter.js` desplaza su ventana al recibir mensajes, no al consultar `totalMeters()`.

Reproducción con reloj controlado: añadir un mensaje, avanzar 60 segundos sin mensajes y consultar el total devuelve 1. Además, la ventana real tiene diez posiciones de un segundo y devuelve su suma, mientras que la capacidad se describe en mensajes por segundo. Hay que definir y normalizar la unidad de medida.

## Implementado, pero pendiente o incompleto

- **Persistencia MySQL:** existe el modelo y código real de consulta, alta y edición. En este equipo, `GET /api/nodos` devolvió 500 con `ECONNREFUSED`; no había servicio escuchando en 3306. No se probaron escritura, edición, visibilidad ni exportación contra datos reales. No se encontró SQL de instalación, migraciones, semilla ni llamada a `sequelize.sync()` que prepare la tabla.
- **Borrado:** main no tiene ruta DELETE ni acción de borrado. `DELETE /api/nodo/1` devuelve 404. Ocultar un nodo sí está implementado, pero no equivale a borrarlo.
- **Detalle de nodos:** consulta DEBUG una vez al abrir; no se refresca mientras permanece abierto y no maneja explícitamente el error de un nodo caído. La fecha de «última consulta» se guarda al destruir el diálogo, aunque DEBUG haya fallado. Cerrar antes de cargar el catálogo también puede acceder a `this.nodo` sin inicializar. Estas observaciones proceden de la lectura del código.
- **Sondeo:** no hay timeout explícito por proceso. El grafo espera a todos mediante `forkJoin`; un proceso que mantenga abierta la conexión retrasa al conjunto. Los errores al consultar el catálogo no tienen recuperación de sondeo en el grafo. El mapa puede solapar rondas porque programa el temporizador fuera de la finalización de las peticiones.
- **Disponibilidad:** se interpreta cualquier DEBUG HTTP correcto como nodo activo, sin validar el contenido de la respuesta. Las conexiones visuales son relaciones declaradas por los procesos, no una medición de tráfico entre ellos.
- **Procesamiento de datos:** `processor/c_processor.js`, `processMessage`, imprime el mensaje y responde 200. No realiza transformación de datos, almacenamiento ni análisis.
- **Confirmación de envíos:** `commons/commons.js`, `sendSFMPMessage`, devuelve 0 antes de que termine Axios; los 1/-1 devueltos dentro de los callbacks no llegan al llamante. No permite conocer el resultado real del envío.
- **Registro y reconexión:** el procesador envía su registro al principal una sola vez; el envío al sustituto está comentado. Si el principal no está disponible al arrancar, no hay reintento de registro implementado en ese arranque.

## Arranque, configuración y exposición

- **Dependencia no declarada:** `miback/index.js` requiere `cors`, pero no figura en su `package.json` ni entre las dependencias raíz de su lockfile. Arranca gracias al `node_modules` incluido; una instalación limpia que no conserve ese paquete puede fallar.
- **Instalación no reproducida desde cero:** se usaron las dependencias existentes. El éxito de compilación no certifica un `npm ci` limpio. Hay 7.209 archivos de `node_modules` versionados sobre 7.706 archivos totales en main.
- **Build de producción de starter:** el código compiló, pero la generación de `index.html` falló al descargar fuentes de Google. Primero se bloqueó la red del sandbox; fuera de él apareció `unable to verify the first certificate`. Es una dependencia externa y una limitación del entorno probado, no un error TypeScript confirmado. El build de desarrollo terminó correctamente. No se certifica el artefacto de producción.
- **Versiones locales:** pruebas con Node 24.15.0 y npm 10.5.0. El proyecto starter incluye `.nvmrc` con Node 20; no se repitió la prueba en esa versión.
- **Configuración duplicada:** hay `.env` en la raíz de v2 y en cada rol, con intervalos de actualización distintos. `dotenv.config()` lee según el directorio de ejecución: usar los scripts npm o arrancar dentro de la carpeta de un rol puede cambiar el comportamiento.
- **Despliegue:** la URL del catálogo está fijada a `localhost` y las consultas a procesos parten del navegador. En otro ordenador, localhost apunta a ese ordenador; el usuario debe tener acceso a cada proceso y a sus puertos. Una interfaz HTTPS con servicios HTTP también necesita resolver el contenido mixto.
- **Acceso:** no se encontraron controles de autenticación o autorización en las rutas del catálogo ni SFMP. Las operaciones de configuración y registro están expuestas igual que DEBUG y CORS está abierto. Los guards importados por la interfaz principal no se aplican a sus rutas. La autenticación simulada de Fuse no protege estas APIs.
- **Secretos:** hay una clave de acceso TTN literal en `backend/v2/balancer/ttn/configTTN.js`, además de configuración `.env` versionada. No se ha comprobado si la clave sigue vigente. Debe rotarse si lo está y sacarse del código; eliminarla en un commit no borra el historial.
- **Documentación y comprobaciones:** el README raíz solo contiene el título. No se encontró una guía de arranque del sistema, automatización CI ni pruebas propias fuera de dependencias. `miback` llama «test» a arrancar el servidor; v2 tiene el script de test de ejemplo que termina en error.

## Orden propuesto para recuperar el proyecto

1. **Poder arrancarlo de forma repetible:** declarar dependencias, documentar Node y comandos, preparar esquema/semilla MySQL y ofrecer configuración de ejemplo sin secretos. Rotar la clave expuesta si sigue vigente.
2. **Poder confiar en la pantalla:** encadenar configuración y carga, comparar nodos por ID, contemplar listas vacías y cambios del catálogo, actualizar conexiones desde DEBUG y recuperar errores con timeout por nodo.
3. **Corregir el funcionamiento distribuido:** reprogramar la actualización de carga, definir las unidades, aplicar los pesos o documentar el reparto uniforme y recuperar el registro cuando el principal no esté disponible.
4. **Cerrar una prueba real completa:** MySQL → catálogo → procesos reales → consulta DEBUG → grafo/lista/mapa, incluyendo alta, edición, ocultación, caída, sustitución y recuperación. Después validar TTN con credenciales vigentes.
5. **Evolucionar según el objetivo:** autenticación y despliegue si se va a compartir; recolector central, históricos y alertas si se quiere convertir en un monitor continuo. Estas últimas capacidades son ampliaciones, no arreglos de la interfaz existente.

No se ha modificado código de aplicación, cambiado de rama ni tocado la base de datos durante el diagnóstico.

## Comprobación posterior al arranque de XAMPP

Tras arrancar XAMPP, se confirmó conexión correcta a `tfg` en MariaDB 10.4.32. La tabla `nodos` existe y contiene los campos esperados por el modelo, con 18 registros, todos visibles. Se verificaron con la API real las consultas de listado, listado ordenado, detalle por ID y búsqueda con coincidencias: todas devolvieron HTTP 200. Las altas y modificaciones siguen sin probarse.

Los 17 registros con direcciones locales consultables devolvieron conexión rechazada al pedir DEBUG: no había procesos escuchando en sus destinos. El registro 53 tiene `url=http://localhost:4002` y `puerto=4002`; el cliente concatena ambos y genera una dirección inválida con el puerto duplicado. Debe dejarse la URL base sin puerto. Se ha identificado el dato, sin modificarlo.

Los registros 31–36 apuntan a la topología de ejemplo: balanceadores 3100/3101, controladores 3000/3001 y procesadores 4001/4002. El siguiente paso es guardar una copia de la base y arrancar una topología controlada para verificar la visualización contra procesos reales. Esta comprobación solo ha leído datos; el servidor temporal de la API se ha detenido.

## Comprobación con los procesos reales arrancados

Se verificó después el sistema activo del usuario, con frontend en 4200 y API en 8080, ambos con HTTP 200. De los 18 nodos del catálogo, tres respondieron correctamente a DEBUG: CM1 (3000), BS1 (3101) y P3 (4003). Otros catorce devolvieron conexión rechazada y P8 mantuvo su URL inválida con el puerto duplicado.

CM1 contiene un único procesador registrado, `process3`, con capacidad 100, preferencia 0,5, `AYACOUNT=3` y carga asignada del 100 %. BS1 tiene `balancerSubsActive=true`, apunta al principal no disponible en 3100 y contiene ese mismo procesador como destino. P3 confirma los coordinadores configurados en 3000 y 3001.

Se abrió la interfaz real en una sesión independiente de Edge, se leyeron los tres diálogos y se inspeccionaron los datos dibujados por ECharts. El grafo muestra exactamente CM1 → BS1 → P3, coincidiendo con las respuestas de los procesos. Durante la inspección se bloquearon las peticiones PUT automáticas del diálogo para no modificar la fecha de consulta del catálogo.

Los dos contadores de mensajes mostraron 2 durante las consultas. Este valor no demuestra entrada MQTT o entrega reciente de mensajes. También se observó que el contador AYA de BS1 continúa descendiendo por debajo de cero (-14 y posteriormente -20); el indicador no está limitado a cero aunque el sustituto ya esté activo. No se pararon ni arrancaron procesos del usuario ni se inyectaron mensajes en esta comprobación.
