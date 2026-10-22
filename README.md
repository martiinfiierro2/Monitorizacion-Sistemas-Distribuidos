# Monitorización de sistemas distribuidos

Interfaz Angular con grafo, mapa y catálogo MySQL/MariaDB, más procesos SFMP de coordinación, balanceo y procesamiento.

## Requisitos e instalación

La configuración comprobada utiliza Node 24.15.0 (ver `frontend/starter/.nvmrc`) y MySQL/MariaDB. XAMPP sirve para el desarrollo local.

Desde la raíz:

```powershell
npm.cmd ci --prefix backend/miback
npm.cmd ci --prefix backend/v2
npm.cmd ci --prefix frontend/starter
```

Copiar `backend/miback/.env.example` a `backend/miback/.env` y `backend/v2/.env.example` a `backend/v2/.env` **solo si no existen**. Los `.env` actuales se conservan en el equipo, pero ya no se versionan. Configurar base, usuario y contraseña del catálogo; la configuración v2 se lee siempre desde `backend/v2/.env`, independientemente del directorio de arranque.

Si npm falla con el certificado del proxy en Node 24, se puede usar `NODE_OPTIONS=--use-system-ca` para utilizar los certificados del sistema. No desactivar la verificación TLS.

## Base de datos

Antes de modificar una base existente, exportarla desde phpMyAdmin o con `mysqldump`. No se ejecutan migraciones ni semillas automáticamente al arrancar.

Para una base nueva llamada `tfg`, crear primero la base y después:

```powershell
npm.cmd --prefix backend/miback run db:init
```

Para cargar datos de demostración, únicamente en una tabla vacía:

```powershell
npm.cmd --prefix backend/miback run db:init -- --seed
```

`db:init` también permite preparar el índice único de una instalación existente. Antes comprueba las direcciones normalizadas y se detiene si hay duplicados o datos inválidos; no los borra ni los corrige automáticamente. En el catálogo original, P8 y P2 se refieren al mismo destino al normalizar el puerto de P8. Revisar esas fichas antes de aplicar el índice. La interfaz tolera los datos antiguos y muestra los avisos correspondientes.

## Arranque local

Con MySQL de XAMPP encendido:

```powershell
npm.cmd start
```

Esto arranca el catálogo y Angular. Abrir **http://127.0.0.1:4200**. El frontend utiliza `/api` mediante el proxy de Angular, sin fijar el nombre del equipo en el código. Si ya había servidores abiertos, cerrarlos antes para liberar 4200 y 8080.

También pueden arrancarse por separado, en dos terminales desde la raíz:

```powershell
npm.cmd --prefix backend/miback start
npm.cmd --prefix frontend/starter start
```

Para arrancar además los dos grupos de demostración:

```powershell
npm.cmd run demo
```

La demo usa los puertos 3000/3001, 3100/3101, 4001–4003 y 5000/5001, 4100/4101, 5002–5004. Usa nombres únicos y desactiva MQTT: permite consultar topología, registro y sustitución sin conectar a TTN. La tabla debe contener las fichas de esos destinos para representarlos. Guardar una ficha no arranca el proceso.

Los scripts `.bat` de cada rol siguen disponibles. No arrancar la demo sobre procesos que ya ocupen esos puertos. Los procesadores reintentan su registro, por lo que no dependen de un orden concreto de arranque.

## Supervisión y reparto

- Un único ciclo AYA comprueba el principal y, cuando corresponde, los procesadores. Funciona igual bajo coordinador principal o sustituto. `AYASENDTIME` determina el intervalo; las consultas y el envío de configuración ocurren en cada ciclo operativo. El antiguo `UPDATE_CONFIG` deja de crear un temporizador separado.
- La capacidad y `receivedRate` se expresan en mensajes/s. `receivedMessages` cuenta los mensajes de la ventana móvil de diez segundos. Sin tráfico, la ventana envejece hasta cero.
- El reparto entre destinos usa sus pesos `load`. Los errores de entrega prueban otros destinos y conservan pendientes para reintentar.
- Los pendientes se guardan en `backend/v2/.data/balancer-<puerto>.json`, o en `DATA_DIR`. La cola tiene límite `QUEUE_LIMIT`; al llenarse, rechaza y registra el mensaje en consola y en `delivery.rejected`. No se promete entrega ilimitada ni ausencia de pérdidas ante disco lleno, caída del broker o saturación.
- Cada mensaje conserva el UID en los reintentos. Los procesadores conservan una ventana de deduplicación de 24 horas y 10.000 identificadores en su archivo de datos. No eliminar estos archivos mientras haya entregas pendientes. El procesamiento incluido sigue siendo recepción y registro en consola, no una transformación de negocio.
- Las colas de distintos balanceadores no son una cola distribuida replicada. Un balanceador que vuelve a arrancar conserva sus pendientes locales. Particiones de red y entrega exactamente una vez requieren una solución de coordinación/broker adicional.

## Interfaz

Grafo y mapa utilizan el mismo cálculo de topología. Solo muestran enlaces operativos entre destinos disponibles y visibles, y distinguen supervisión de asignación. Una línea no acredita tráfico.

Ambas vistas permiten filtrar por grupo inferido, tipo y disponibilidad, actualizar, ocultar conexiones y ajustar vista. Los grupos se deducen de las referencias de configuración disponibles: con todos los procesos apagados puede aparecer «Sin grupo». No se inventa una pertenencia persistente a partir del nombre del nodo.

El mapa representa un solo mundo, sin repetirse al arrastrar. Al abrirlo encuadra el mapamundi dentro del ancho y la altura reales del panel, con margen para los iconos; se adapta también a ventanas bajas y paneles reducidos. El desplazamiento queda limitado al mundo. «Ajustar vista» encuadra los nodos visibles cuando se pulsa.

Dentro del grafo y del mapa, la rueda y la pinza del panel táctil cambian la escala de la representación. La cabecera y el resto de la página conservan su tamaño, incluso cuando el dibujo alcanza su límite de zoom.

El refresco automático respeta `espera.valor` de `frontend/starter/src/assets/theme/config.json` (5000 ms por defecto). Cada ronda consulta hasta ocho nodos simultáneamente, con timeout individual, y publica todos los resultados juntos. Mientras tanto se conserva la ronda anterior, sin mostrar consultas pendientes como desconexiones. Una caída real se refleja al completar la ronda; si dura más que el intervalo, se evita solaparla con otra. Un fallo de catálogo conserva el último dibujo con aviso de datos anteriores. Al salir se cancelan las consultas y se liberan mapa y gráfico. El detalle distingue procesadores registrados de seleccionados, se refresca mientras está abierto y registra la fecha solo después de una consulta correcta.

El catálogo permite buscar, crear, editar, ocultar, exportar y eliminar fichas. El borrado pide confirmación y no detiene ejecutables.
Comparte el marco y los controles compactos de las vistas de monitorización, con búsqueda en la cabecera, visibilidad junto al nombre y una tabla con desplazamiento propio y paginación fija.
La paginación está en español. Las operaciones correctas muestran una confirmación breve que se cierra sola; los errores mantienen su aviso específico. La confirmación de borrado identifica la ficha y recuerda que el ejecutable seguirá funcionando.

## TTN y acceso fuera del equipo

La clave que estaba escrita en el código se ha retirado. **Si sigue vigente, rotarla en TTN**: retirarla de esta rama no elimina su exposición en el historial.

Configurar `TTN_APP_ID`, `TTN_ACCESS_KEY`, `MQTT_URL` y, después, `MQTT_ENABLED=true` en el entorno de v2. La conexión predeterminada usa MQTT con TLS. DEBUG muestra `mqttConnected`, cola y contadores de entrega.

Por defecto, catálogo y procesos escuchan en 127.0.0.1. Para exponerlos hay que configurar explícitamente `LISTEN_HOST` y una clave:

- `API_TOKEN` protege el catálogo; se introduce en «Acceso protegido» de la interfaz y se conserva solo en sessionStorage.
- `SFMP_TOKEN` protege DEBUG, SFMP y `/msg`; debe coincidir en todos los roles y en el entorno del catálogo.
- El frontend usa por defecto el proxy DEBUG del catálogo (`debugProxy: true`). Así la clave SFMP permanece en el servidor y el navegador no necesita alcanzar cada puerto. Para pruebas locales directas puede configurarse `debugProxy: false` en `assets/theme/config.json`.
- `CORS_ORIGINS` define los orígenes autorizados. Para producción, servir frontend y `/api` bajo HTTPS en el mismo origen o configurar `apiUrl` en el JSON de configuración. El hosting debe resolver las rutas de Angular hacia `index.html`.

Estas claves compartidas son control de acceso de la instalación; no equivalen a cuentas personales ni permisos por usuario. No exponer una instalación de demostración sin completar la configuración de acceso y TLS.

## Pruebas

```powershell
npm.cmd test
npm.cmd run build
```

Las pruebas Node comprueban validación/API con repositorio en memoria, pesos, reintentos, cola persistente, idempotencia, caída bajo sustituto, recuperación, registro tardío y reglas de topología. También verifican con un reloj virtual que el refresco conserve rondas completas ante respuestas lentas, timeout, cambios de catálogo y cancelación. Los procesos de integración usan puertos libres, directorios temporales y MQTT simulado; no acceden a la base real.

Para repetir las pruebas del navegador, instalar previamente `@playwright/cli` y disponer de Edge. Con 24500 libre:

```powershell
npm.cmd run test:browser
```

Este comando compila en desarrollo, sirve una vista de pruebas en localhost, utiliza catálogos controlados y escribe `diagnostico/regresion-navegador.json`. No requiere escribir en MySQL. Los escenarios se conservan en `tests/ui`.

GitHub Actions instala las tres aplicaciones desde sus lockfiles y ejecuta pruebas y build. La configuración no incluye contraseñas ni requiere XAMPP en CI.

Informes históricos: [diagnóstico de main](DIAGNOSTICO_MAIN.md), [pruebas previas](PRUEBAS_CONEXIONES_MAIN.md). Ver [resultado de las correcciones](CORRECCIONES.md) para el estado de esta rama.
