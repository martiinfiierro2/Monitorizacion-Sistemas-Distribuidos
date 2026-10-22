import { Component, ViewEncapsulation, EventEmitter, Output, Inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, MatPaginator, MatPaginatorIntl } from '@angular/material/paginator';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MAT_DIALOG_DATA, MatDialog, MatDialogContent, MatDialogRef, MatDialogTitle, MatDialogModule } from '@angular/material/dialog';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Subject, Subscription, debounceTime, distinctUntilChanged, switchMap, catchError, of, startWith } from 'rxjs';
import { GrafoService } from 'app/services/grafo.service';
import { ConfigService } from 'app/services/config.service';
import { CatalogNode, nodeTypes } from 'app/services/topology';
import { readableError } from 'app/services/monitor.service';
import { Dialog } from '../dialogs/dialog.component';
import { spanishPaginatorIntl } from './paginator-es';
export interface NodeData extends CatalogNode {
    tiempo: string;
    visible: boolean;
}
@Component({ selector: 'lista', standalone: true, templateUrl: './lista.component.html', styleUrls: ['../monitoring.scss'], encapsulation: ViewEncapsulation.None, providers: [{ provide: MatPaginatorIntl, useFactory: spanishPaginatorIntl }], imports: [MatTableModule, MatToolbarModule, MatIconModule, MatInputModule, MatPaginatorModule, MatButtonToggleModule, MatButtonModule, CommonModule, ReactiveFormsModule, MatTooltipModule, MatSnackBarModule] })
export class ListaComponent {
    listaNodos: NodeData[] = [];
    displayedColumns = ['nombre', 'tipo_nodo', 'url', 'puerto', 'geolocalizacion', 'actions'];
    dataSource = new MatTableDataSource<NodeData>([]);
    @ViewChild(MatPaginator)
    paginator: MatPaginator;
    error = '';
    loading = true;
    private query = new Subject<string>();
    private subscription: Subscription;
    private search = '';
    constructor(private http: GrafoService, private config: ConfigService, private router: Router, private dialog: MatDialog, private notifications: MatSnackBar) { }
    ngOnInit() { this.subscription = this.config.getConfig().pipe(switchMap(() => this.query.pipe(startWith(''), debounceTime(200), distinctUntilChanged(), switchMap(text => { this.loading = true; return this.http.buscarNodos(text).pipe(catchError(error => of({ nodos: [], queryError: readableError(error) }))); })))).subscribe(result => { this.loading = false; this.error = result.queryError || ''; this.actualizarDataSource(result.nodos); }); }
    ngAfterViewInit() { this.dataSource.paginator = this.paginator; }
    ngOnDestroy() { this.subscription?.unsubscribe(); this.query.complete(); this.notifications.dismiss(); }
    buscarNodos(text: string) { this.search = text; this.query.next(text); }
    getNodos() { this.http.buscarNodos(this.search).subscribe({ next: result => { this.error = ''; this.actualizarDataSource(result.nodos); }, error: error => this.error = readableError(error) }); }
    actualizarDataSource(nodes: NodeData[]) { this.listaNodos = nodes; this.dataSource.data = nodes; this.paginator?.firstPage(); }
    irAGrafo() { this.router.navigate(['/grafo']); }
    irAMapa() { this.router.navigate(['/mapa']); }
    dialogo(tipo: any, id: any, url: any, puerto: any) { this.dialog.open(Dialog, { data: { tipo, id, url, puerto } }); }
    anadirNodo() { this.notifications.dismiss(); this.dialog.open(AnadirNodo, { panelClass: 'node-editor-panel', width: '820px', maxWidth: 'calc(100vw - 48px)', maxHeight: 'calc(100dvh - 48px)' }).afterClosed().subscribe(saved => { if (saved) {
        this.getNodos(); this.notify('Ficha añadida correctamente.'); } }); }
    actualizarNodo(nodo: NodeData) { this.notifications.dismiss(); this.dialog.open(ActualizarNodo, { data: { nodo }, panelClass: 'node-editor-panel', width: '820px', maxWidth: 'calc(100vw - 48px)', maxHeight: 'calc(100dvh - 48px)' }).afterClosed().subscribe(saved => { if (saved) {
        this.getNodos(); this.notify('Cambios guardados correctamente.'); } }); }
    async eliminarNodo(nodo: NodeData) { this.notifications.dismiss(); const confirmed = await firstValueFrom(this.dialog.open(DeleteNodeDialog, { data: nodo, panelClass: 'node-editor-panel', width: '500px', maxWidth: 'calc(100vw - 48px)', maxHeight: 'calc(100dvh - 48px)' }).afterClosed()); if (!confirmed) return; try {
        await this.http.deleteNodo(nodo.id);
        this.getNodos();
        this.notify('Ficha eliminada del catálogo.');
    }
    catch (error) {
        this.error = readableError(error);
    } }
    async visible(nodo: NodeData) { await this.setVisibility(nodo, true); }
    async noVisible(nodo: NodeData) { await this.setVisibility(nodo, false); }
    private async setVisibility(nodo: NodeData, visible: boolean) { this.notifications.dismiss(); try {
        await this.http.putNodo({ ...nodo, visible });
        this.getNodos();
        this.notify(`${nodo.nombre}: ${visible ? 'visible' : 'oculto'} en grafo y mapa.`);
    }
    catch (error) {
        this.error = readableError(error);
    } }
    private notify(message: string) { this.notifications.open(message, 'Cerrar', { duration: 3500, horizontalPosition: 'left', verticalPosition: 'bottom', panelClass: 'catalog-feedback', politeness: 'polite' }); }
    descargar() { this.http.getNodos().subscribe({ next: data => { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'listaNodos.json'; link.click(); URL.revokeObjectURL(url); }, error: error => this.error = readableError(error) }); }
}
const editorImports = [MatDialogTitle, MatDialogContent, MatIconModule, MatGridListModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatSelectModule, CommonModule, MatDialogModule, FormsModule];
class NodeEditor {
    options = nodeTypes.map(value => ({ value, viewValue: value, icon: ({ 'Controlador Main': 'cMainAct.png', 'Controlador Subs': 'cSubsAct.png', 'Balanceador Main': 'bMainAct.png', 'Balanceador Subs': 'bSubsAct.png', 'Procesador': 'procesadorAct.png' })[value] }));
    dialogClosed = new EventEmitter<void>();
    errorPeticion = '';
    errorPeticion2 = '';
    busy = false;
    tipoNodo = 'Procesador';
    puerto: string;
    url = 'http://127.0.0.1';
    nombre = '';
    latitud: number;
    longitud: number;
    visible = true;
    orden: number;
    nodo: NodeData;
    constructor(protected http: GrafoService, protected ref: MatDialogRef<any>) { }
    cerrarDialog() { this.ref.close(); }
    guardarNodo() { return this.save(this.nodo?.id); }
    protected async save(id?: number) {
        if (this.busy)
            return;
        this.busy = true;
        this.errorPeticion = '';
        this.errorPeticion2 = '';
        try {
            const data = { id, tipo_nodo: this.tipoNodo, nombre: this.nombre, url: this.url, puerto: this.puerto, latitud: this.latitud, longitud: this.longitud, visible: this.visible, orden: this.orden };
            id ? await this.http.putNodo(data) : await this.http.postNodo(data);
            this.dialogClosed.emit();
            this.ref.close(true);
        }
        catch (error) {
            this.errorPeticion = (error.error?.errores || []).map(e => e.msg).join(' · ');
            this.errorPeticion2 = this.errorPeticion || readableError(error);
        }
        finally {
            this.busy = false;
        }
    }
}
@Component({ selector: 'dialog-add-node', standalone: true, templateUrl: '../dialogs/node-editor.html', styleUrls: ['../dialogs/node-editor.scss'], imports: editorImports, encapsulation: ViewEncapsulation.None })
export class AnadirNodo extends NodeEditor {
    constructor(http: GrafoService, ref: MatDialogRef<AnadirNodo>) { super(http, ref); }
    anadirNodo() { return this.save(); }
}
@Component({ selector: 'dialog-edit-node', standalone: true, templateUrl: '../dialogs/node-editor.html', styleUrls: ['../dialogs/node-editor.scss'], imports: editorImports, encapsulation: ViewEncapsulation.None })
export class ActualizarNodo extends NodeEditor {
    constructor(http: GrafoService, ref: MatDialogRef<ActualizarNodo>,
    @Inject(MAT_DIALOG_DATA)
    private data: any) { super(http, ref); }
    ngOnInit() { this.nodo = this.data.nodo; const n = this.nodo; this.tipoNodo = n.tipo_nodo; this.nombre = n.nombre; this.url = n.url; this.puerto = n.puerto; this.latitud = Number(n.latitud); this.longitud = Number(n.longitud); this.visible = Boolean(n.visible); this.orden = n.orden; }
    actualizarNodo() { return this.save(this.nodo.id); }
}

@Component({ selector: 'dialog-delete-node', standalone: true, imports: [MatDialogModule, MatButtonModule, MatIconModule], templateUrl: '../dialogs/delete-node.html', styleUrls: ['../dialogs/node-editor.scss'], encapsulation: ViewEncapsulation.None })
export class DeleteNodeDialog {constructor(@Inject(MAT_DIALOG_DATA)public node:NodeData,private ref:MatDialogRef<DeleteNodeDialog>){} close(confirmed:boolean){this.ref.close(confirmed);}}
