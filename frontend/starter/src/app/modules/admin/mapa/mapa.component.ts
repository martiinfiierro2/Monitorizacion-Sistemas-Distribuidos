import { Component, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import * as L from 'leaflet';
import 'leaflet-polylinedecorator';
import { GrafoService } from 'app/services/grafo.service';
import { MonitorService } from 'app/services/monitor.service';
import { validCoordinates } from 'app/services/topology';
import { MonitorView } from '../monitor-view';
import { MonitorToolbarComponent } from '../monitor-toolbar.component';
@Component({ selector: 'mapa', standalone: true, imports: [CommonModule, MonitorToolbarComponent], templateUrl: './mapa.component.html', styleUrls: ['../monitoring.scss'], encapsulation: ViewEncapsulation.None })
export class MapaComponent extends MonitorView {
    map: L.Map;
    iconos: L.Marker[] = [];
    lineas: L.Polyline[] = [];
    private arrows: L.Layer[] = [];
    private first = true;
    private resize: ResizeObserver;
    constructor(monitor: MonitorService, api: GrafoService, dialog: MatDialog, router: Router) { super(monitor, api, dialog, router); }
    ngAfterViewInit() { this.start(); }
    render() {
        if (!this.snapshot)
            return;
        if (!this.map) {
            this.map = L.map('map').setView([this.configuracion.map.latitud, this.configuracion.map.longitud], this.configuracion.map.zoom);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(this.map);
            this.resize = new ResizeObserver(() => this.map.invalidateSize());
            this.resize.observe(this.map.getContainer());
        }
        [...this.iconos, ...this.lineas, ...this.arrows].forEach(layer => this.map.removeLayer(layer));
        this.iconos = [];
        this.lineas = [];
        this.arrows = [];
        const selected = this.selectedNodes.filter(s => validCoordinates(s.nodo)), ids = new Set(selected.map(s => s.nodo.id));
        for (const s of selected) {
            const n = s.nodo;
            const marker = L.marker([Number(n.latitud), Number(n.longitud)], { title: n.nombre, icon: L.icon({ iconUrl: 'assets/map/png/' + this.icon(s), iconSize: [48, 48], iconAnchor: [24, 24] }) }).addTo(this.map);
            const label = document.createElement('span');
            label.textContent = n.nombre + ' · ' + s.group;
            marker.bindTooltip(label, { className: 'monitor-node-tooltip', direction: 'top', offset: [0, -24] });
            marker.on('click', () => this.dialogo(n.tipo_nodo, n.id, n.url, n.puerto));
            this.iconos.push(marker);
        }
        for (const link of this.selectedLinks.filter(l => ids.has(l.source) && ids.has(l.target))) {
            const source = selected.find(s => s.nodo.id === link.source).nodo, target = selected.find(s => s.nodo.id === link.target).nodo;
            const color = link.kind === 'assignment' ? '#18823b' : '#687587';
            const line = L.polyline([[Number(source.latitud), Number(source.longitud)], [Number(target.latitud), Number(target.longitud)]], { color, weight: 3, dashArray: link.kind === 'supervision' ? '6 5' : undefined }).addTo(this.map);
            this.lineas.push(line);
            if ((L as any).polylineDecorator)
                this.arrows.push((L as any).polylineDecorator(line, { patterns: [{ offset: '55%', repeat: 0, symbol: (L as any).Symbol.arrowHead({ pixelSize: 10, polygon: true, pathOptions: { color, fillOpacity: 1, weight: 1 } }) }] }).addTo(this.map));
        }
        if (this.first && this.iconos.length) {
            this.first = false;
            this.fit();
        }
    }
    fit() { if (this.iconos.length)
        this.map.fitBounds(L.featureGroup(this.iconos).getBounds().pad(0.15), { maxZoom: 10 }); }
    ngOnDestroy() { super.ngOnDestroy(); this.resize?.disconnect(); this.map?.remove(); }
}
