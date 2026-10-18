export interface CatalogNode {
    id: number;
    tipo_nodo: string;
    nombre: string;
    url: string;
    puerto: string;
    latitud: number | string;
    longitud: number | string;
    visible: boolean | number;
    orden?: number;
    tiempo?: string;
    grupo?: string;
}
export interface NodeState {
    nodo: CatalogNode;
    datos: any;
    status: boolean;
    error?: string;
    endpoint: string;
    group?: string;
    lastSeen?: number;
    pending?: boolean;
}
export interface TopologyLink {
    source: number;
    target: number;
    kind: 'assignment' | 'supervision';
}
export interface Topology {
    nodes: NodeState[];
    links: TopologyLink[];
    warnings: string[];
}
export const nodeTypes = ['Controlador Main', 'Controlador Subs', 'Balanceador Main', 'Balanceador Subs', 'Procesador'];
export function normalizeEndpoint(value: string, port?: string | number): string {
    const parsed = new URL(String(value).trim());
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password)
        throw new Error('Dirección HTTP no válida');
    if (port !== undefined && String(port) !== '') {
        if (!/^\d+$/.test(String(port)) || Number(port) < 1 || Number(port) > 65535)
            throw new Error('Puerto no válido');
        if (parsed.port && Number(parsed.port) !== Number(port))
            throw new Error('El puerto de la URL no coincide');
        parsed.port = String(port);
    }
    if (['localhost', '[::1]'].includes(parsed.hostname))
        parsed.hostname = '127.0.0.1';
    return parsed.origin;
}
export function validDebug(node: CatalogNode, response: any): boolean {
    const data = response?.Data;
    if (!nodeTypes.includes(node.tipo_nodo) || !data || typeof data.internalConfig !== 'object' || !data.internalConfig)
        return false;
    if (node.tipo_nodo.startsWith('Balanceador'))
        return Array.isArray(data.balancerList);
    if (node.tipo_nodo.startsWith('Controlador'))
        return Array.isArray(data.balancerList) && Array.isArray(data.processorsList);
    return true;
}
export function validCoordinates(node: CatalogNode): boolean {
    return node.latitud !== null && node.longitud !== null && String(node.latitud).trim() !== '' && String(node.longitud).trim() !== '' &&
        Number.isFinite(Number(node.latitud)) && Number.isFinite(Number(node.longitud)) && Math.abs(Number(node.latitud)) <= 90 && Math.abs(Number(node.longitud)) <= 180;
}
export function buildTopology(states: NodeState[]): Topology {
    const warnings: string[] = [], links: TopologyLink[] = [];
    const byUrl = new Map<string, NodeState>(), parent = new Map<number, number>();
    const find = (id: number): number => { const p = parent.get(id); if (p === id)
        return id; const root = find(p); parent.set(id, root); return root; };
    states.forEach(s => { parent.set(s.nodo.id, s.nodo.id); if (s.endpoint) {
        if (byUrl.has(s.endpoint))
            warnings.push(s.nodo.nombre + ': dirección duplicada en el catálogo');
        else
            byUrl.set(s.endpoint, s);
    } });
    const resolve = (value: string): NodeState | undefined => { try {
        return byUrl.get(normalizeEndpoint(value));
    }
    catch {
        return undefined;
    } };
    const visible = (s: NodeState) => s.nodo.visible !== false && s.nodo.visible !== 0;
    const add = (from: NodeState, to: NodeState | undefined, kind: TopologyLink['kind']) => {
        if (from.status && to?.status && visible(from) && visible(to) && !links.some(l => l.source === from.nodo.id && l.target === to.nodo.id && l.kind === kind))
            links.push({ source: from.nodo.id, target: to.nodo.id, kind });
    };
    const activeBalancer = (s: NodeState | undefined) => s?.status && (s.nodo.tipo_nodo === 'Balanceador Main' || (s.nodo.tipo_nodo === 'Balanceador Subs' && s.datos.Data.balancerSubsActive === true));
    for (const state of states) {
        if (state.error)
            warnings.push(state.nodo.nombre + ': ' + state.error);
        if (!nodeTypes.includes(state.nodo.tipo_nodo))
            warnings.push(state.nodo.nombre + ': tipo desconocido');
        if (!validCoordinates(state.nodo))
            warnings.push(state.nodo.nombre + ': coordenadas no válidas; se omite en el mapa');
        if (!state.status)
            continue;
        const data = state.datos.Data, config = data.internalConfig;
        const references = [config.urlMain, config.urlBalancerMain, config.urlBalancerSubs, config.urlCoordinatorlMain, config.urlCoordinatorMain, config.urlCoordinatorSubs, ...(data.balancerList || []).map(p => p.url)].filter(Boolean);
        for (const ref of references) {
            const other = resolve(ref);
            if (other)
                parent.set(find(state.nodo.id), find(other.nodo.id));
            else
                warnings.push(state.nodo.nombre + ': destino fuera del catálogo (' + ref + ')');
        }
        if (state.nodo.tipo_nodo.endsWith('Subs'))
            add(state, resolve(config.urlMain || config.urlCoordinatorlMain), 'supervision');
        if (state.nodo.tipo_nodo === 'Balanceador Main' || (state.nodo.tipo_nodo === 'Balanceador Subs' && data.balancerSubsActive === true)) {
            for (const processor of data.balancerList || [])
                add(state, resolve(processor.url), 'assignment');
        }
        if (state.nodo.tipo_nodo === 'Controlador Main' || (state.nodo.tipo_nodo === 'Controlador Subs' && data.coordinatorSubsActive === true)) {
            const main = resolve(config.urlBalancerMain), subs = resolve(config.urlBalancerSubs);
            add(state, activeBalancer(main) ? main : activeBalancer(subs) ? subs : undefined, 'assignment');
        }
    }
    const members = new Map<number, number[]>();
    states.forEach(s => { const root = find(s.nodo.id); members.set(root, [...(members.get(root) || []), s.nodo.id]); });
    const roots = [...members.keys()].filter(root => members.get(root).length > 1).sort((a, b) => Math.min(...members.get(a)) - Math.min(...members.get(b)));
    return { nodes: states.map(s => ({ ...s, group: s.nodo.grupo || ((roots.indexOf(find(s.nodo.id)) >= 0) ? 'Grupo ' + (roots.indexOf(find(s.nodo.id)) + 1) : 'Sin grupo') })), links, warnings: [...new Set(warnings)] };
}
