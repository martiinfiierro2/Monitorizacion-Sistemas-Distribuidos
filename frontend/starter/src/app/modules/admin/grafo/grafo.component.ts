import { Component, ElementRef, ViewChild, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import * as echarts from 'echarts';
import { GrafoService } from 'app/services/grafo.service';
import { MonitorService } from 'app/services/monitor.service';
import { MonitorView } from '../monitor-view';
import { MonitorToolbarComponent } from '../monitor-toolbar.component';
@Component({ selector: 'grafo', standalone: true, imports: [CommonModule, MonitorToolbarComponent], templateUrl: './grafo.component.html', styleUrls: ['../monitoring.scss'], encapsulation: ViewEncapsulation.None })
export class GrafoComponent extends MonitorView {
    @ViewChild('chart')
    container: ElementRef<HTMLElement>;
    myChart: echarts.ECharts;
    private resize: ResizeObserver;
    private resetView = false;
    constructor(monitor: MonitorService, api: GrafoService, dialog: MatDialog, router: Router) { super(monitor, api, dialog, router); }
    ngAfterViewInit() {
        this.myChart = echarts.init(this.container.nativeElement);
        this.myChart.on('click', (params: any) => { if (params.dataType === 'node') {
            const n = this.selectedNodes.find(s => s.nodo.id === Number(params.data.id))?.nodo;
            if (n)
                this.dialogo(n.tipo_nodo, n.id, n.url, n.puerto);
        } });
        this.resize = new ResizeObserver(() => { this.myChart.resize(); this.render(); });
        this.resize.observe(this.container.nativeElement);
        this.start();
    }
    render() {
        if (!this.myChart || !this.snapshot)
            return;
        const groups = [...new Set(this.selectedNodes.map(s => s.group))].sort();
        const width = Math.max(500, this.container.nativeElement.clientWidth);
        const offsets = new Map<string, number>();
        let offset = 0;
        for (const group of groups) {
            offsets.set(group, offset);
            const members = this.selectedNodes.filter(node => node.group === group);
            const processors = members.filter(node => !node.nodo.tipo_nodo.startsWith('Controlador') && !node.nodo.tipo_nodo.startsWith('Balanceador')).length;
            offset += Math.max(240, Math.ceil(processors / Math.max(1, Math.ceil(Math.sqrt(processors)))) * 90 + 100);
        }
        const previous = (this.myChart.getOption() as any)?.series?.[0];
        const nodes = this.selectedNodes.map(s => {
            const column = s.nodo.tipo_nodo.startsWith('Controlador') ? 0 : s.nodo.tipo_nodo.startsWith('Balanceador') ? 1 : 2;
            const siblings = this.selectedNodes.filter(n => n.group === s.group && (n.nodo.tipo_nodo.startsWith('Controlador') ? 0 : n.nodo.tipo_nodo.startsWith('Balanceador') ? 1 : 2) === column);
            const row = siblings.findIndex(n => n.nodo.id === s.nodo.id);
            const columns = column === 2 ? Math.max(1, Math.ceil(Math.sqrt(siblings.length))) : 1;
            const x = column === 0 ? 60 : column === 1 ? width * .28 : width * .53 + (row % columns) * width * .4 / Math.max(1, columns - 1);
            const y = 50 + offsets.get(s.group) + Math.floor(row / columns) * 90;
            return { id: String(s.nodo.id), name: s.nodo.nombre, x, y, symbol: 'image://assets/map/png/' + this.icon(s), symbolSize: this.configuracion.map.iconSize || 60, group: s.group, tipo_nodo: s.nodo.tipo_nodo, status: s.status, endpoint: s.endpoint, error: s.error };
        });
        this.myChart.setOption({ animation: false, tooltip: { trigger: 'item', formatter: (p: any) => p.dataType === 'node' ? [p.data.name, p.data.group, p.data.tipo_nodo, p.data.status ? 'Responde' : 'Sin respuesta válida', p.data.endpoint].map(v => String(v || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))).join('<br>') : p.data.kind === 'supervision' ? 'Supervisión' : 'Asignación operativa' }, series: [{ type: 'graph', layout: 'none', roam: true, zoom: this.resetView ? 1 : (previous?.zoom || 1), center: this.resetView ? undefined : previous?.center, scaleLimit: { min: 0.2, max: 4 }, label: { show: true, position: 'bottom', formatter: (p: any) => p.data.name }, data: nodes, links: this.selectedLinks.map(l => ({ ...l, source: String(l.source), target: String(l.target), lineStyle: { color: l.kind === 'assignment' ? '#18823b' : '#687587', width: l.kind === 'assignment' ? 3 : 2, type: l.kind === 'assignment' ? 'solid' : 'dashed', curveness: 0.12 } })), edgeSymbol: ['none', 'arrow'], edgeSymbolSize: [0, 12] }] }, true);
        this.resetView = false;
    }
    fit() { this.resetView = true; this.render(); }
    ngOnDestroy() { super.ngOnDestroy(); this.resize?.disconnect(); this.myChart?.dispose(); }
}
