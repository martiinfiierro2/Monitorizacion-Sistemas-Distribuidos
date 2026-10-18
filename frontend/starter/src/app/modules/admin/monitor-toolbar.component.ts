import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MonitorSnapshot } from 'app/services/monitor.service';
import { nodeTypes } from 'app/services/topology';
export interface ViewFilters {
    group: string;
    type: string;
    status: string;
}
@Component({ selector: 'monitor-toolbar', standalone: true, imports: [CommonModule, FormsModule], template: `
<section class="monitor-toolbar" aria-label="Controles de monitorización">
  <div class="monitor-summary"><strong>{{title}}</strong><span>{{online}} / {{snapshot?.nodes?.length || 0}} responden</span><span *ngIf="snapshot?.refreshedAt">Actualizado {{snapshot.refreshedAt | date:'HH:mm:ss'}}</span><span *ngIf="snapshot?.stale" role="status">Datos anteriores</span></div>
  <div class="monitor-controls">
    <label>Grupo <select [(ngModel)]="filters.group" (ngModelChange)="changed.emit()"><option value="">Todos</option><option *ngFor="let group of groups" [value]="group">{{group}}</option></select></label>
    <label>Tipo <select [(ngModel)]="filters.type" (ngModelChange)="changed.emit()"><option value="">Todos</option><option *ngFor="let type of types" [value]="type">{{type}}</option></select></label>
    <label>Estado <select [(ngModel)]="filters.status" (ngModelChange)="changed.emit()"><option value="">Todos</option><option value="online">Responden</option><option value="offline">Sin respuesta válida</option></select></label>
    <label class="monitor-check"><input type="checkbox" [checked]="!connections" (change)="toggle.emit($event)"> Desactivar conexiones</label>
    <button type="button" (click)="refresh.emit()">Actualizar</button><button type="button" (click)="fit.emit()">Ajustar vista</button>
  </div>
  <p class="monitor-legend"><span class="legend-assignment"></span> Asignación operativa <span class="legend-supervision"></span> Supervisión · Una conexión no confirma entrega de mensajes.</p>
  <p *ngIf="snapshot?.error" class="monitor-error" role="alert">{{snapshot.error}}</p>
  <details *ngIf="snapshot?.warnings?.length"><summary>{{snapshot.warnings.length}} avisos de nodos y conexiones</summary><ul><li *ngFor="let warning of snapshot.warnings">{{warning}}</li></ul></details>
  <details><summary>Acceso protegido</summary><form (ngSubmit)="connect.emit(token); token=''" class="monitor-controls"><label>Clave de acceso <input type="password" name="token" [(ngModel)]="token" autocomplete="current-password"></label><button type="submit">Conectar</button></form></details>
</section>`, styleUrls: ['./monitoring.scss'] })
export class MonitorToolbarComponent {
    @Input()
    title = 'Monitorización';
    @Input()
    snapshot: MonitorSnapshot;
    @Input()
    filters: ViewFilters;
    @Input()
    connections = true;
    @Output()
    changed = new EventEmitter<void>();
    @Output()
    refresh = new EventEmitter<void>();
    @Output()
    fit = new EventEmitter<void>();
    @Output()
    toggle = new EventEmitter<any>();
    @Output()
    connect = new EventEmitter<string>();
    types = nodeTypes;
    token = '';
    get groups() { return [...new Set(this.snapshot?.nodes.map(s => s.group) || [])].sort(); }
    get online() { return this.snapshot?.nodes.filter(s => s.status).length || 0; }
}
