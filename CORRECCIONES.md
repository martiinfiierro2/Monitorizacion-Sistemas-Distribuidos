# Correcciones de la rama fix/monitorizacion-fiable

Se han corregido los fallos reproducidos sobre main y se ha añadido una base de pruebas repetible. El catálogo original de XAMPP se conserva: no se han aplicado migraciones, semillas ni escrituras de prueba a sus registros.

## Cambios principales

- Supervisión única de principales y sustitutos, retirada de procesadores caídos, reconciliación al recuperar principales y registro reintentable en ambos coordinadores.
- Reparto ponderado, cola local persistente con reintentos y confirmación correlacionada, deduplicación persistente por procesador, y contadores de pendientes, entregados, fallos y rechazos.
- Ventana de carga que envejece sin tráfico y unidades en mensajes/s. Los contadores AYA quedan limitados a cero.
- Topología común para grafo y mapa: respeta roles confirmados, disponibilidad y ocultación; admite principales ausentes del catálogo, normaliza direcciones y aísla respuestas inválidas.
- Refresco automático por rondas completas, conservando la anterior mientras llegan las respuestas, con timeout individual, recuperación tras errores del catálogo y cancelación al navegar. Altas, bajas, vacío, nombres, visibilidad y cambios de conexiones se reflejan sin recargar. Las consultas pendientes ya no causan desconexiones provisionales ni conexiones incoherentes.
- Filtros por grupo inferido, tipo y estado, leyenda, flechas del mapa, ajuste de vista, nombres completos accesibles, avisos visibles y redimensionado del gráfico.
- Detalle con refresco, error explícito, fecha registrada solo tras consulta correcta y tablas separadas de registrados y seleccionados. También expone entrega, MQTT y estado del registro cuando el proceso proporciona esos datos.
- Catálogo con validación de campos, búsquedas vacías correctas, cancelación/debounce, exportación y borrado confirmado. Los scripts del segundo grupo tienen nombres únicos.
- URLs configurables, proxy DEBUG en el catálogo, acceso opcional mediante claves, escucha local predeterminada y secretos fuera del código. Se retiró la autenticación simulada de Fuse del flujo de las APIs reales.
- Esquema y semilla opcionales, protección contra migrar duplicados, instalación documentada, arranque desde la raíz, limpieza del seguimiento de dependencias y entornos privados, y CI.

## Verificación

### Refresco automático, 20 de octubre de 2026

- `npm test`: 17 pruebas correctas, incluidas seis regresiones del servicio de monitorización con reloj virtual. Se comprueban respuestas desordenadas y lentas, timeout y recuperación, cambios de catálogo, cancelación y un catálogo de 18 nodos con ocho consultas simultáneas como máximo.
- La prueba de integración de procesos falló inicialmente en «entrega normal» al ejecutarse junto a la compilación. Pasó después de forma aislada y en la repetición completa; no se modificó el runtime de los ejecutables.
- `npm.cmd run test:browser`: 67 comprobaciones correctas con Playwright CLI y Edge. Utilizan respuestas controladas, incluyendo tres rondas automáticas con una respuesta de 650 ms en grafo y mapa. Se sustituyeron las esperas fijas de arranque por la comprobación de que la vista esté lista. Resultados: [regresion-navegador.json](diagnostico/regresion-navegador.json).
- La API habitual en 8080 y Angular en 4200 no estaban arrancados durante esta revisión; no se certifica una observación nueva con el catálogo de XAMPP y los ejecutables de la instalación.
- Compilación de producción correcta mediante `npm.cmd run build -- --output-path dist/refresco-verificacion` desde `frontend/starter`. Se utilizó una salida distinta para conservar la compilación de desarrollo que servían las pruebas del navegador. Persisten los avisos existentes de Leaflet/CommonJS y tamaño inicial.

### Verificación anterior de la rama

- `npm test`: 11 pruebas correctas. Pruebas Node de API, validación, reparto, persistencia, reintentos, idempotencia, topología y procesos reales aislados. La caída del procesador se simula de forma abrupta, sin permitir desregistro limpio.
- La integración verifica además un mensaje enviado mientras la lista todavía contiene al procesador caído: el mensaje pendiente termina en el superviviente.
- `npm run build`: compilación de producción correcta. Se eliminó la descarga obligatoria de fuentes en build; los iconos de la aplicación usan los recursos SVG locales.
- Instalación limpia de miback con `npm ci --ignore-scripts` y prueba de API: correcta en una carpeta temporal. En este entorno fue necesario usar los certificados del sistema con Node 24.
- Regresión de los 56 casos originales de grafo y mapa: todos correctos. Evidencias: [regresion-navegador.json](diagnostico/regresion-navegador.json).
- El comando completo `npm run test:browser` terminó con 65 comprobaciones correctas y cerró su entorno aislado. Incluye las 56 originales y nueve de catálogo, detalle y acceso protegido.
- Pruebas adicionales de catálogo y detalle: [catalogo-detalle-resultados.json](diagnostico/catalogo-detalle-resultados.json).

Las pruebas de navegador y los procesos de integración utilizan respuestas controladas o directorios/puertos de prueba. La entrada MQTT de las pruebas es simulada; no se certifica TTN real ni una instalación de producción.

## Pasos de configuración que requieren el entorno real

1. Cerrar los servidores antiguos y arrancar con `npm.cmd start` para utilizar el proxy y los procesos actualizados. Usar `npm.cmd run demo` si se quieren levantar ambos grupos sin TTN.
2. Revisar P8/P2 en el catálogo original: al normalizar la URL representan el mismo destino. La aplicación evita el puerto duplicado y avisa del duplicado, pero no decide qué ficha del usuario debe eliminarse. No ejecutar la semilla sobre esta tabla.
3. Rotar en TTN la clave que estaba expuesta y configurar una nueva mediante entorno si se desea entrada MQTT real. La clave retirada puede seguir en el historial anterior.
4. Configurar claves y HTTPS antes de exponer servicios fuera del equipo. Las claves compartidas incluidas no son un sistema de cuentas personales.

## Límites explícitos

La cola es local a cada balanceador y tiene un límite configurable. Los archivos de estado requieren disco disponible. La deduplicación es por procesador, tiene ventana y tamaño limitados y no constituye entrega global exactamente una vez. Las particiones de red y la coordinación distribuida de colas no se han resuelto con consenso o un broker durable compartido. El procesamiento de negocio y los históricos/alertas no se añaden en esta corrección.

Persisten avisos de optimización de Leaflet/CommonJS y de tamaño inicial de la plantilla Fuse (aproximadamente 3,1 MB sin comprimir, 449 kB estimados en transferencia). No impiden compilar. La interfaz histórica `frontend/frontfog` se conserva; los cambios funcionales se aplican a la interfaz principal `frontend/starter`.

Los diagnósticos anteriores describen main antes de estas correcciones; sus fallos no deben interpretarse como el estado actual de esta rama.
