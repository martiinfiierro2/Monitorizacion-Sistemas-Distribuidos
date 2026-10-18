import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogTitle, MatDialogContent } from '@angular/material/dialog';
import { Subscription, forkJoin, timer, exhaustMap, catchError, of } from 'rxjs';
import { GrafoService } from 'app/services/grafo.service';
import { ConfigService } from 'app/services/config.service';
import { validDebug, CatalogNode } from 'app/services/topology';
import { readableError } from 'app/services/monitor.service';
@Component({ selector: 'dialogDatos', standalone: true, imports: [CommonModule, MatDialogTitle, MatDialogContent], templateUrl: './dialog.html', styleUrls: ['../monitoring.scss'], encapsulation: ViewEncapsulation.None })
export class Dialog {
    nodo: CatalogNode;
    tipo: string;
    estado_interno: any;
    error = '';
    loading = true;
    lastQuery: number;
    private subscriptions = new Subscription();
    private recorded = false;
    constructor(private api: GrafoService, private config: ConfigService, private dialogRef: MatDialogRef<Dialog>,
    @Inject(MAT_DIALOG_DATA)
    private data: any) { this.tipo = data.tipo; this.dialogRef.addPanelClass('node-detail-panel'); }
    ngOnInit() {
        this.subscriptions.add(forkJoin({ config: this.config.getConfig(), node: this.api.getNodo(this.data.id) }).subscribe({ next: ({ config, node }) => {
                this.nodo = node.nodo;
                this.subscriptions.add(timer(0, config.espera.valor).pipe(exhaustMap(() => this.api.readNodeDebug(this.nodo).pipe(catchError(error => of({ queryError: readableError(error) }))))).subscribe(response => {
                    this.loading = false;
                    if (response.queryError || !validDebug(this.nodo, response)) {
                        this.error = response.queryError || 'Respuesta de estado no válida';
                        return;
                    }
                    this.error = '';
                    this.estado_interno = response;
                    this.lastQuery = Date.now();
                    if (!this.recorded) {
                        this.recorded = true;
                        this.subscriptions.add(this.api.recordQuery(this.nodo.id).pipe(catchError(() => of(null))).subscribe());
                    }
                }));
            }, error: error => { this.loading = false; this.error = readableError(error); } }));
    }
    get selected() { return this.estado_interno?.Data?.balancerList || []; }
    get registered() { return this.estado_interno?.Data?.processorsList || []; }
    get currentRole() { const d = this.estado_interno?.Data; if (!d)
        return 'Sin confirmar'; if (this.tipo.endsWith('Main'))
        return 'Principal'; if (this.tipo === 'Procesador')
        return 'Procesador'; return d.balancerSubsActive || d.coordinatorSubsActive ? 'Sustituto activo' : 'Sustituto en espera'; }
    cerrarDialog() { this.dialogRef.close(); }
    ngOnDestroy() { this.subscriptions.unsubscribe(); }
}
