# Refresco automático

Pendiente indicado por Martín al cerrar la sesión del 18 de octubre de 2026: **revisar la recarga automática por defecto, que causa incongruencias temporales en los estados y conexiones**.

- Corregido el 20 de octubre de 2026 en `frontend/starter/src/app/services/monitor.service.ts`: cada ronda se publica completa; mientras se consulta se conserva la anterior.
- Se mantiene el intervalo configurado en `espera.valor`, los timeouts y la protección contra rondas simultáneas. Una consulta pendiente ya no se representa como desconexión.
- Investigación ya realizada: [REFRESCO.md](diagnostico/escritorio-real/REFRESCO.md).
- La composición de escritorio, navegación con ratón, mapa y modal quedan aprobados por el usuario en el commit `55763aa`, rama `fix/monitorizacion-fiable`.
