import { Subject, Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { Directive } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Dialog } from './dialogs/dialog.component';
import { GrafoService } from 'app/services/grafo.service';
import { MonitorService, MonitorSnapshot } from 'app/services/monitor.service';
import { NodeState } from 'app/services/topology';
@Directive()
export abstract class MonitorView {
    snapshot: MonitorSnapshot;
    configuracion: any;
    datosDelSistema: NodeState[] = [];
    activarConexiones = true;
    timerSubscription: Subscription;
    filters = { group: '', type: '', status: '' };
    protected refresh$ = new Subject<void>();
    constructor(protected monitor: MonitorService, protected api: GrafoService, protected dialog: MatDialog, protected router: Router) { }
    protected start() { this.timerSubscription = this.monitor.watch(this.refresh$).subscribe(snapshot => { this.snapshot = snapshot; this.configuracion = snapshot.config; this.datosDelSistema = snapshot.nodes; this.render(); }); }
    get selectedNodes() { return (this.snapshot?.nodes || []).filter(s => s.nodo.visible !== false && s.nodo.visible !== 0 && (!this.filters.group || s.group === this.filters.group) && (!this.filters.type || s.nodo.tipo_nodo === this.filters.type) && (!this.filters.status || (this.filters.status === 'online' ? s.status : !s.status))); }
    get selectedLinks() { const ids = new Set(this.selectedNodes.map(s => s.nodo.id)); return this.activarConexiones ? (this.snapshot?.links || []).filter(l => ids.has(l.source) && ids.has(l.target)) : []; }
    protected icon(s: NodeState) { const c = this.configuracion; const t = s.nodo.tipo_nodo; if (t === 'Procesador' || !['Controlador Main', 'Controlador Subs', 'Balanceador Main', 'Balanceador Subs'].includes(t))
        return s.status ? c.processor.png : c.processor.pngDes; const role = t.startsWith('Controlador') ? c.controller : c.balancer; return role['png' + (t.endsWith('Main') ? 'Main' : 'Subs') + (s.status ? '' : 'Des')]; }
    abstract render(): void;
    comprobar() { this.refresh$.next(); }
    conexiones(event: any) { this.activarConexiones = !(event.checked ?? event.target?.checked); this.render(); }
    connect(token: string) { this.api.setToken(token); this.comprobar(); }
    irALista() { this.router.navigate(['/lista']); }
    irAGrafo() { this.router.navigate(['/grafo']); }
    irAMapa() { this.router.navigate(['/mapa']); }
    dialogo(tipo: any, id: any, url: any, puerto: any) { this.dialog.open(Dialog, { data: { tipo, id, url, puerto } }); }
    ngOnDestroy() { this.timerSubscription?.unsubscribe(); this.refresh$.complete(); }
}
