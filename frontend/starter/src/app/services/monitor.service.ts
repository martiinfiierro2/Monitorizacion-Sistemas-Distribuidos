import { Injectable } from '@angular/core';
import { Observable, catchError, defer, exhaustMap, from, map, merge, mergeMap, of, scan, switchMap, timer, toArray } from 'rxjs';
import { GrafoService } from './grafo.service';
import { Config, ConfigService } from './config.service';
import { buildTopology, CatalogNode, NodeState, normalizeEndpoint, Topology, validDebug } from './topology';
export interface MonitorSnapshot extends Topology {
    config: Config;
    error?: string;
    refreshedAt?: number;
    stale?: boolean;
}
export function readableError(error: any): string {
    if (error?.status === 401)
        return 'Acceso no autorizado. Introduce la clave de acceso.';
    if (error?.name === 'TimeoutError')
        return 'Tiempo de espera agotado';
    return error?.error?.msg || error?.message || 'No se pudo consultar el servicio';
}
@Injectable({ providedIn: 'root' })
export class MonitorService {
    private lastSeen = new Map<number, number>();
    constructor(private api: GrafoService, private config: ConfigService) { }
    private round(config: Config): Observable<MonitorSnapshot> {
        return this.api.getNodosOrdenados().pipe(switchMap(response => {
            if (!Array.isArray(response.nodos))
                throw new Error('El catálogo no contiene una lista de nodos');
            const requests = response.nodos.map((nodo: CatalogNode) => defer(() => {
                const endpoint = normalizeEndpoint(nodo.url, nodo.puerto);
                return this.api.readNodeDebug(nodo).pipe(map(datos => {
                    const status = validDebug(nodo, datos);
                    if (status)
                        this.lastSeen.set(nodo.id, Date.now());
                    return { nodo, datos, status, endpoint, lastSeen: this.lastSeen.get(nodo.id), error: status ? undefined : 'Respuesta de estado no válida' } as NodeState;
                }));
            }).pipe(catchError(error => { let endpoint = ''; try {
                endpoint = normalizeEndpoint(nodo.url, nodo.puerto);
            }
            catch { } return of({ nodo, datos: null, status: false, endpoint, lastSeen: this.lastSeen.get(nodo.id), error: readableError(error) } as NodeState); })));
            // Publish one complete round so pending requests never look like outages
            // or mix connections from different rounds. Keep the catalog's order.
            const states = from(requests as Observable<NodeState>[]).pipe(
                mergeMap(request => request, 8),
                toArray(),
                map(all => {
                    const byId = new Map(all.map(state => [state.nodo.id, state]));
                    return (response.nodos as CatalogNode[]).map(nodo => byId.get(nodo.id)!);
                })
            );
            return states.pipe(map(all => ({ ...buildTopology(all), config, refreshedAt: Date.now() })));
        }), catchError(error => of({ nodes: [], links: [], warnings: [], config, error: readableError(error), stale: true })));
    }
    watch(refresh: Observable<void>): Observable<MonitorSnapshot> {
        return this.config.getConfig().pipe(switchMap(config => merge(timer(0, config.espera.valor), refresh).pipe(exhaustMap(() => this.round(config)), scan((previous: MonitorSnapshot, current: MonitorSnapshot) => current.error ? { ...previous, config, error: current.error, stale: true } : current, { nodes: [], links: [], warnings: [], config } as MonitorSnapshot))));
    }
}
